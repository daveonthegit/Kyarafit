import { mergeMediaManifests, type ByoMediaEntry, validateMediaHash } from "./byoMediaManifest";
import {
  canonicalJson,
  compareText,
  fail,
  identifier,
  json,
  keys,
  object,
  timestamp,
  type SnapshotJson,
} from "./byoSnapshotJson";

export { SnapshotFormatError } from "./byoSnapshotJson";

export const BYO_SCHEMA_VERSION = 1;
export const BYO_TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** All personal/local-first tables, matching backfill and warm-up, NOT social/auth/billing data. */
export const BYO_PERSONAL_TABLES = [
  "builds",
  "conventions",
  "cosplayNodes",
  "workflowItems",
  "packingListItems",
  "buildTasks",
  "workflowAttachments",
  "workflowDependencies",
  "conventionDayPlans",
  "buildReferenceImages",
  "buildProcessPictures",
  "buildProgressUpdates",
] as const;
export type ByoPersonalTable = (typeof BYO_PERSONAL_TABLES)[number];

export interface ByoSnapshotRecord {
  /** Stable local/client identity, not a device-specific remapped server id. */
  id: string;
  updatedAt: number;
  deletedAt: number | null;
  /** Portable fields, mapped by an adapter. Never put auth credentials in this payload. */
  data: { [key: string]: SnapshotJson };
  mediaHashes: string[];
}

/** Permanent compact deletion barrier: no personal payload or media, only identity and clocks. */
export interface ByoDeletionMarker {
  id: string;
  updatedAt: number;
  deletedAt: number;
}

export interface ByoSnapshot {
  schemaVersion: typeof BYO_SCHEMA_VERSION;
  tables: Record<ByoPersonalTable, ByoSnapshotRecord[]>;
  retired: Record<ByoPersonalTable, ByoDeletionMarker[]>;
  media: ByoMediaEntry[];
}

function emptyTables<T>(): Record<ByoPersonalTable, T[]> {
  return {
    builds: [],
    conventions: [],
    cosplayNodes: [],
    workflowItems: [],
    packingListItems: [],
    buildTasks: [],
    workflowAttachments: [],
    workflowDependencies: [],
    conventionDayPlans: [],
    buildReferenceImages: [],
    buildProcessPictures: [],
    buildProgressUpdates: [],
  };
}

/** New snapshots explicitly contain every table, even when empty. */
export function emptyByoSnapshot(): ByoSnapshot {
  return {
    schemaVersion: BYO_SCHEMA_VERSION,
    tables: emptyTables<ByoSnapshotRecord>(),
    retired: emptyTables<ByoDeletionMarker>(),
    media: [],
  };
}

function record(raw: unknown): ByoSnapshotRecord {
  const row = object(raw);
  keys(row, ["id", "updatedAt", "deletedAt", "data", "mediaHashes"]);
  if (!Array.isArray(row.mediaHashes)) fail("Expected media hashes.");
  return {
    id: identifier(row.id),
    updatedAt: timestamp(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : timestamp(row.deletedAt),
    data: json(object(row.data)) as ByoSnapshotRecord["data"],
    mediaHashes: [...new Set(row.mediaHashes.map(validateMediaHash))].sort(compareText),
  };
}

function marker(raw: unknown): ByoDeletionMarker {
  const row = object(raw);
  keys(row, ["id", "updatedAt", "deletedAt"]);
  return {
    id: identifier(row.id),
    updatedAt: timestamp(row.updatedAt),
    deletedAt: timestamp(row.deletedAt),
  };
}

/** Strict v1 decoder: unknown versions/fields fail closed rather than silently losing data. */
export function validateByoSnapshot(input: unknown): ByoSnapshot {
  const snapshot = object(input);
  if (snapshot.schemaVersion !== BYO_SCHEMA_VERSION)
    fail("Unsupported BYO snapshot schema version.");
  keys(snapshot, ["schemaVersion", "tables", "retired", "media"]);
  const tables = object(snapshot.tables);
  const retired = object(snapshot.retired);
  keys(tables, BYO_PERSONAL_TABLES);
  keys(retired, BYO_PERSONAL_TABLES);
  const result = emptyByoSnapshot();
  result.media = mergeMediaManifests(snapshot.media);
  const hashes = new Set(result.media.map((entry) => entry.hash));
  let count = 0;
  for (const table of BYO_PERSONAL_TABLES) {
    const rows = tables[table];
    const markers = retired[table];
    if (!Array.isArray(rows) || !Array.isArray(markers)) fail("Expected snapshot table arrays.");
    count += rows.length + markers.length;
    if (count > 100_000) fail("Snapshot exceeds the record limit.");
    const ids = new Set<string>();
    result.tables[table] = rows.map((raw) => {
      const row = record(raw);
      if (ids.has(row.id)) fail("Duplicate snapshot record id.");
      ids.add(row.id);
      if (row.mediaHashes.some((hash) => !hashes.has(hash))) fail("Missing media manifest entry.");
      return row;
    });
    result.retired[table] = markers.map((raw) => {
      const row = marker(raw);
      if (ids.has(row.id)) fail("Duplicate snapshot record id.");
      ids.add(row.id);
      return row;
    });
    result.tables[table].sort((a, b) => compareText(a.id, b.id));
    result.retired[table].sort((a, b) => compareText(a.id, b.id));
  }
  return result;
}

export function parseByoSnapshot(serialized: string): ByoSnapshot {
  if (serialized.length > 10_000_000) fail("Snapshot exceeds the serialized size limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail("Invalid snapshot JSON.");
  }
  return validateByoSnapshot(parsed);
}

/** Canonical file export; an exact round trip, independent of insertion order or device locale. */
export function serializeByoSnapshot(snapshot: ByoSnapshot): string {
  const serialized = canonicalJson(validateByoSnapshot(snapshot));
  if (serialized.length > 10_000_000) fail("Snapshot exceeds the serialized size limit.");
  return serialized;
}
