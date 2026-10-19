import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestVault } from "@/test-support/vaultHarness";
import { __setActiveVaultForTests, activeVaultImageDir } from "./activeVault";
import { setOfflineConnectivity } from "@/offline/connectivity";
import {
  writeVaultBackup,
  pickAndImportVaultBackup,
  discardVaultBackup,
} from "./portabilityDevice";
import { vaultKeyForSubject } from "@/offline/db";
import { readVaultArchiveImages, readVaultArchiveManifest, writeVaultArchive } from "./archive";

const fs = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  directories: new Set<string>(),
  failPhotoWrite: false,
  failPhotoMove: false,
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Share: {} }));
vi.mock("expo-file-system", () => {
  const uri = (parts: (string | { uri: string })[]) =>
    parts.map((part) => (typeof part === "string" ? part : part.uri).replace(/\/$/, "")).join("/");
  class Directory {
    readonly uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(parts);
    }
    get exists() {
      return fs.directories.has(this.uri);
    }
    create() {
      fs.directories.add(this.uri);
    }
  }
  class File {
    uri: string;
    static async pickFileAsync() {
      return new File("file:///picked");
    }
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = uri(parts);
    }
    get exists() {
      return fs.files.has(this.uri);
    }
    get size() {
      return fs.files.get(this.uri)?.length ?? 0;
    }
    create() {
      if (this.exists) throw new Error("Destination exists");
      fs.files.set(this.uri, new Uint8Array());
    }
    delete() {
      fs.files.delete(this.uri);
    }
    write(bytes: Uint8Array) {
      if (fs.failPhotoWrite && this.uri.endsWith(".restore")) {
        fs.files.set(this.uri, bytes.slice(0, 1));
        throw new Error("Disk full");
      }
      fs.files.set(this.uri, Uint8Array.from(bytes));
    }
    move(destination: File) {
      if (fs.files.has(destination.uri)) throw new Error("Destination exists");
      if (fs.failPhotoMove && this.uri.endsWith(".restore")) throw new Error("Move failed");
      fs.files.set(destination.uri, fs.files.get(this.uri)!);
      fs.files.delete(this.uri);
      this.uri = destination.uri;
    }
    bytesSync() {
      return fs.files.get(this.uri)!;
    }
    open() {
      let offset = 0;
      return {
        close: () => {},
        readBytes: (length: number) => {
          const bytes = fs.files.get(this.uri)!.subarray(offset, offset + length);
          offset += bytes.length;
          return bytes;
        },
        writeBytes: (bytes: Uint8Array) => {
          const previous = fs.files.get(this.uri)!;
          const next = new Uint8Array(previous.length + bytes.length);
          next.set(previous);
          next.set(bytes, previous.length);
          fs.files.set(this.uri, next);
        },
      };
    }
  }
  return { Directory, File, Paths: { cache: { uri: "file:///cache" } } };
});

const PHOTO = Uint8Array.from([1, 2, 3, 4]);
beforeEach(() => {
  fs.files.clear();
  fs.directories.clear();
  fs.failPhotoWrite = false;
  fs.failPhotoMove = false;
  setOfflineConnectivity(true);
  const vault = makeTestVault({ subject: "owner" });
  vault.store.commit((db) =>
    db.insert("builds", {
      userId: "owner",
      name: "Cloud",
      status: "idea",
      imageStorageId: "storage",
    })
  );
  __setActiveVaultForTests(vault.store);
});
afterEach(() => {
  __setActiveVaultForTests(null);
  vi.unstubAllGlobals();
  setOfflineConnectivity(true);
});

describe("device cloud-original backup", () => {
  it("resolves and fetches the original and streams its bytes into the archive", async () => {
    const resolve = vi.fn(async () => "https://example.com/original");
    const fetch = vi.fn(async () => new Response(PHOTO));
    vi.stubGlobal("fetch", fetch);
    const backup = await writeVaultBackup(resolve);
    expect(resolve).toHaveBeenCalledWith("storage");
    expect(fetch).toHaveBeenCalledWith("https://example.com/original");
    expect(backup.summary).toMatchObject({ images: 1, missingImages: [] });
    const bytes = fs.files.get(backup.uri)!;
    let offset = 0;
    const reader = {
      read: (length: number) => {
        const result = bytes.subarray(offset, offset + length);
        offset += length;
        return result;
      },
    };
    const manifest = readVaultArchiveManifest(reader);
    const originals: Uint8Array[] = [];
    readVaultArchiveImages(reader, manifest, (_key, image) => originals.push(image));
    expect(originals).toEqual([PHOTO]);
    expect(manifest.rows[0].doc.imageStorageId).toBeUndefined();
    expect(manifest.rows[0].doc.imageUrl).toBe(`kyarafit-image:${manifest.images[0].key}`);
  });

  it("isolates overlapping exports and discards only the owning invocation's file", async () => {
    let finishFirst!: (response: Response) => void;
    const secondPhoto = Uint8Array.from([5, 6, 7]);
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            finishFirst = done;
          })
      )
      .mockResolvedValueOnce(new Response(secondPhoto));
    vi.stubGlobal("fetch", fetch);
    const now = new Date("2026-10-18T12:34:56.000Z");
    const resolve = async () => "https://example.com/original";
    const firstPending = writeVaultBackup(resolve, now);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const firstUri = [...fs.files.keys()][0];
    const second = await writeVaultBackup(resolve, now);
    expect(second.uri).not.toBe(firstUri);
    finishFirst(new Response(PHOTO));
    const first = await firstPending;
    expect(first.uri).toBe(firstUri);

    for (const [backup, expectedPhoto] of [[first, PHOTO], [second, secondPhoto]] as const) {
      expect(backup.uri).toContain(`/backups/${vaultKeyForSubject("owner")}/`);
      expect(backup.uri).toMatch(/kyarafit-backup-2026-10-18T12-34-56.*\.kyarafit$/);
      expect(backup.summary).toMatchObject({ rows: 1, images: 1, missingImages: [] });
      const bytes = fs.files.get(backup.uri)!;
      let offset = 0;
      const reader = {
        read: (length: number) => {
          const chunk = bytes.subarray(offset, offset + length);
          offset += length;
          return chunk;
        },
      };
      const manifest = readVaultArchiveManifest(reader);
      const originals: Uint8Array[] = [];
      readVaultArchiveImages(reader, manifest, (_key, image) => originals.push(image));
      expect(manifest.rows).toHaveLength(1);
      expect(originals).toEqual([expectedPhoto]);
      expect(offset).toBe(bytes.length);
    }

    const secondBytes = fs.files.get(second.uri)!.slice();
    discardVaultBackup(first.uri);
    expect(fs.files.has(first.uri)).toBe(false);
    expect(fs.files.get(second.uri)).toEqual(secondBytes);
    discardVaultBackup(second.uri);
    expect(fs.files.has(second.uri)).toBe(false);
    const stagingDirectory = `file:///cache/backups/${vaultKeyForSubject("owner")}/`;
    expect([...fs.files.keys()].filter((uri) => uri.startsWith(stagingDirectory))).toEqual([]);
  });

  it.each(["success", "disk-full", "move-failed"])(
    "preserves originals through staged photo writes (%s)",
    async (outcome) => {
      const chunks: Uint8Array[] = [];
      writeVaultArchive(
        {
          subject: "owner",
          now: 1,
          rows: [{ table: "builds", id: "restored", doc: { imageUrl: "kyarafit-image:photo" } }],
          imageSize: () => PHOTO.length,
          readImage: () => PHOTO,
        },
        { write: (bytes) => chunks.push(bytes) }
      );
      fs.files.set("file:///picked", Uint8Array.from(Buffer.concat(chunks)));
      const originalUri = `${activeVaultImageDir()!.replace(/\/$/, "")}/photo`;
      const original = Uint8Array.from([9]);
      fs.files.set(originalUri, original);
      fs.failPhotoWrite = outcome === "disk-full";
      fs.failPhotoMove = outcome === "move-failed";
      const result = await pickAndImportVaultBackup();
      const succeeded = outcome === "success";
      expect(fs.files.get(originalUri)).toEqual(succeeded ? PHOTO : original);
      expect(result?.photosMissing).toEqual(succeeded ? [] : ["photo"]);
      expect(result?.photosWritten).toBe(succeeded ? 1 : 0);
      expect(
        [...fs.files.keys()].some((key) => key.endsWith(".restore") || key.endsWith(".previous"))
      ).toBe(false);
    }
  );

  it("does not request cloud originals offline and records the omission", async () => {
    setOfflineConnectivity(false);
    const resolve = vi.fn(async () => "https://example.com/original");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const backup = await writeVaultBackup(resolve);
    expect(resolve).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(backup.summary.images).toBe(0);
    expect(backup.summary.missingImages).toHaveLength(1);
  });

  it("stops after a vault switch while the URL request is pending", async () => {
    let finish!: (url: string) => void;
    const resolve = vi.fn(
      () =>
        new Promise<string>((done) => {
          finish = done;
        })
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const pending = writeVaultBackup(resolve);
    const rejected = expect(pending).rejects.toThrow("active account changed");
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledOnce());
    __setActiveVaultForTests(makeTestVault({ subject: "other" }).store);
    finish("https://example.com/original");
    await rejected;
    expect(fetch).not.toHaveBeenCalled();
    expect(fs.files.size).toBe(0);
  });
});
