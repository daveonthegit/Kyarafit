import { collectVaultImageKeys } from "./images";

/**
 * Portable vault archive (`.kyarafit`): one file holding every live row of a vault plus the original
 * bytes of every photo those rows reference. Free for everyone; it is the user's own backup.
 *
 * Layout (all offsets in bytes):
 *
 *   "KYARAFIT-VAULT\n"                      magic
 *   "<16-digit manifest length>\n"           header
 *   <manifest JSON, ASCII-only>              rows + image index (see `VaultArchiveManifest`)
 *   <image bytes, concatenated>              in `manifest.images` order
 *
 * Photos are streamed one at a time on both export and import, so archive size is bounded by disk,
 * not memory. The manifest is ASCII-only JSON (non-ASCII escaped as \uXXXX) so it can be encoded and
 * decoded without TextEncoder/TextDecoder. Documents are stored in the vault's portable form (photo
 * references are `kyarafit-image:<key>` tokens, never device paths).
 */

export const VAULT_ARCHIVE_MAGIC = "KYARAFIT-VAULT\n";
export const VAULT_ARCHIVE_FORMAT = "kyarafit-vault";
export const VAULT_ARCHIVE_VERSION = 1;
export const VAULT_ARCHIVE_EXTENSION = ".kyarafit";
const HEADER_DIGITS = 16;

export type VaultArchiveRow = { table: string; id: string; doc: Record<string, unknown> };

export interface VaultArchiveManifest {
  format: typeof VAULT_ARCHIVE_FORMAT;
  version: number;
  exportedAt: number;
  /** The exporting account (informational; import re-owns rows to the importing account). */
  source: { subject: string };
  rows: VaultArchiveRow[];
  /** Photo bytes present in the archive, in data-section order. */
  images: { key: string; size: number }[];
  /** Photos referenced by rows but missing on the exporting device (reported, not fatal). */
  missingImages: string[];
  rowsOmitted: number;
}

/** Sequential byte sink (a FileHandle on device, a Buffer list in tests). */
export interface ByteWriter {
  write(bytes: Uint8Array): void;
}

/** Sequential byte source (a FileHandle on device, a Buffer in tests). */
export interface ByteReader {
  /** Read exactly `length` bytes, or fewer at end of file. */
  read(length: number): Uint8Array;
}

export interface SizedByteReader extends ByteReader {
  readonly remainingBytes: number;
}

export class VaultArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultArchiveError";
  }
}

function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`
  );
}

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) throw new VaultArchiveError("Archive header must be ASCII");
    bytes[i] = code;
  }
  return bytes;
}

function bytesToAscii(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x2000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

function readExactly(reader: ByteReader, length: number, what: string): Uint8Array {
  const bytes = reader.read(length);
  if (bytes.length !== length) throw new VaultArchiveError(`Archive is truncated (${what})`);
  return bytes;
}

export interface ExportSource {
  subject: string;
  now: number;
  /** Live rows in stored (portable) form. */
  rows: VaultArchiveRow[];
  rowsOmitted?: number;
  /** Size of a stored photo, or null when the file is missing. */
  imageSize(key: string): number | null;
  /** Bytes of a stored photo (only called for keys with a size). */
  readImage(key: string): Uint8Array;
}

export interface ExportSummary {
  rows: number;
  images: number;
  missingImages: string[];
  bytes: number;
  rowsOmitted: number;
}

/** Write a complete archive for `source` to `writer`. */
export function writeVaultArchive(source: ExportSource, writer: ByteWriter): ExportSummary {
  const keys = Array.from(collectVaultImageKeys(source.rows.map((row) => row.doc))).sort();
  const images: { key: string; size: number }[] = [];
  const missingImages: string[] = [];
  for (const key of keys) {
    const size = source.imageSize(key);
    if (size == null) missingImages.push(key);
    else images.push({ key, size });
  }
  const manifest: VaultArchiveManifest = {
    format: VAULT_ARCHIVE_FORMAT,
    version: VAULT_ARCHIVE_VERSION,
    exportedAt: source.now,
    source: { subject: source.subject },
    rows: source.rows,
    images,
    missingImages,
    rowsOmitted: source.rowsOmitted ?? 0,
  };
  const manifestBytes = asciiBytes(asciiJson(manifest));
  const header = asciiBytes(`${String(manifestBytes.length).padStart(HEADER_DIGITS, "0")}\n`);
  writer.write(asciiBytes(VAULT_ARCHIVE_MAGIC));
  writer.write(header);
  writer.write(manifestBytes);
  let bytes = VAULT_ARCHIVE_MAGIC.length + header.length + manifestBytes.length;
  for (const image of images) {
    const data = source.readImage(image.key);
    if (data.length !== image.size) {
      throw new VaultArchiveError(`Photo ${image.key} changed size during export`);
    }
    writer.write(data);
    bytes += data.length;
  }
  return {
    rows: source.rows.length,
    images: images.length,
    missingImages,
    bytes,
    rowsOmitted: source.rowsOmitted ?? 0,
  };
}

function isRow(value: unknown): value is VaultArchiveRow {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.table === "string" &&
    typeof row.id === "string" &&
    row.doc !== null &&
    typeof row.doc === "object" &&
    !Array.isArray(row.doc)
  );
}

/** Read and validate the manifest. Throws `VaultArchiveError` for foreign, damaged, or newer files. */
export function readVaultArchiveManifest(reader: ByteReader): VaultArchiveManifest {
  const magic = bytesToAscii(reader.read(VAULT_ARCHIVE_MAGIC.length));
  if (magic !== VAULT_ARCHIVE_MAGIC) {
    throw new VaultArchiveError("This file is not a Kyarafit backup");
  }
  const header = bytesToAscii(readExactly(reader, HEADER_DIGITS + 1, "header"));
  const length = Number(header.slice(0, HEADER_DIGITS));
  if (!/^\d{16}\n$/.test(header) || !Number.isSafeInteger(length)) {
    throw new VaultArchiveError("This Kyarafit backup is damaged");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytesToAscii(readExactly(reader, length, "manifest")));
  } catch (error) {
    if (error instanceof VaultArchiveError) throw error;
    throw new VaultArchiveError("This Kyarafit backup is damaged");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new VaultArchiveError("This Kyarafit backup is damaged");
  }
  const manifest = parsed as Partial<VaultArchiveManifest>;
  if (manifest.format !== VAULT_ARCHIVE_FORMAT || typeof manifest.version !== "number") {
    throw new VaultArchiveError("This file is not a Kyarafit backup");
  }
  if (manifest.version > VAULT_ARCHIVE_VERSION) {
    throw new VaultArchiveError(
      "This backup was made by a newer version of Kyarafit. Update the app to import it."
    );
  }
  if (
    (manifest.rowsOmitted !== undefined &&
      (!Number.isSafeInteger(manifest.rowsOmitted) || manifest.rowsOmitted < 0)) ||
    !Array.isArray(manifest.rows) ||
    !manifest.rows.every(isRow) ||
    !Array.isArray(manifest.images) ||
    !manifest.images.every(
      (image) =>
        image &&
        typeof image.key === "string" &&
        /^[A-Za-z0-9_-]+$/.test(image.key) &&
        Number.isSafeInteger(image.size) &&
        image.size >= 0
    )
  ) {
    throw new VaultArchiveError("This Kyarafit backup is damaged");
  }
  return {
    format: VAULT_ARCHIVE_FORMAT,
    version: manifest.version,
    exportedAt: typeof manifest.exportedAt === "number" ? manifest.exportedAt : 0,
    source: { subject: String(manifest.source?.subject ?? "") },
    rows: manifest.rows,
    rowsOmitted: manifest.rowsOmitted ?? 0,
    images: manifest.images,
    missingImages: Array.isArray(manifest.missingImages)
      ? manifest.missingImages.filter((key): key is string => typeof key === "string")
      : [],
  };
}

/** Stream each photo's bytes to `onImage`, in archive order, after `readVaultArchiveManifest`. */
export function readVaultArchiveImages(
  reader: ByteReader,
  manifest: VaultArchiveManifest,
  onImage: (key: string, bytes: Uint8Array) => void
): void {
  for (const image of manifest.images) {
    onImage(image.key, readExactly(reader, image.size, `photo ${image.key}`));
  }
}
