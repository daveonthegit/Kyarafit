/**
 * Test fixture: Cosapp.si's backup reader, copied (not imported) from the Cosapp.si repo at commit
 * 7306c36, `packages/domain/src/backup/backup.ts` (`decodeBackup`, photo validation; backup schema
 * version 2), `src/sync.ts` (`isSafeFileName`, `rowKey`, `incomingWins`) and `src/store/schema.ts`
 * (column layout, NOT NULL and CHECK constraints). The decode path is kept as close to the original
 * as the copy allows; `assertStoreConstraints` restates the SQLite rules `importBackup` hits when
 * it writes the rows, which `decodeBackup` alone does not check.
 *
 * If Cosapp.si's backup format changes, refresh this copy and `COSAPP_BACKUP_SCHEMA_VERSION`.
 */
import { strFromU8, unzipSync } from "fflate";

export const BACKUP_FORMAT = "cosapp.si/backup";
export const BACKUP_SCHEMA_VERSION = 2;

export const TABLE_NAMES = [
  "builds",
  "pieces",
  "tasks",
  "photos",
  "conventions",
  "dayPlans",
  "packingItems",
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

const ROW = ["id", "createdAt", "updatedAt", "deletedAt"] as const;

export const TABLES: Record<
  TableName,
  { columns: readonly string[]; booleans: readonly string[] }
> = {
  builds: {
    columns: [
      ...ROW,
      "character",
      "series",
      "status",
      "targetDate",
      "targetLabel",
      "budgetCents",
      "notes",
    ],
    booleans: [],
  },
  pieces: {
    columns: [
      ...ROW,
      "buildId",
      "name",
      "kind",
      "status",
      "costCents",
      "link",
      "notes",
      "position",
    ],
    booleans: [],
  },
  tasks: {
    columns: [
      ...ROW,
      "ownerKind",
      "buildId",
      "pieceId",
      "conventionId",
      "title",
      "done",
      "dueDate",
      "remindAt",
      "notes",
      "position",
    ],
    booleans: ["done"],
  },
  photos: {
    columns: [
      ...ROW,
      "buildId",
      "kind",
      "fileName",
      "caption",
      "takenAt",
      "pieceId",
      "conventionId",
    ],
    booleans: [],
  },
  conventions: {
    columns: [
      ...ROW,
      "name",
      "startDate",
      "endDate",
      "location",
      "badgeNote",
      "hotelNote",
      "notes",
    ],
    booleans: [],
  },
  dayPlans: { columns: [...ROW, "conventionId", "date", "buildId"], booleans: [] },
  packingItems: {
    columns: [
      ...ROW,
      "conventionId",
      "key",
      "label",
      "source",
      "checked",
      "buildId",
      "pieceId",
      "position",
    ],
    booleans: ["checked"],
  },
};

type Row = { id: string; createdAt: number; updatedAt: number; deletedAt: number | null };
type Photo = Row & {
  buildId: string | null;
  kind: string;
  fileName: string;
  caption: string | null;
  takenAt: number;
  pieceId: string | null;
  conventionId: string | null;
};
export type StoreRows = Record<TableName, Row[]>;

export interface BackupData {
  format: string;
  schemaVersion: number;
  exportedAt: number;
  appVersion: string;
  rows: StoreRows;
}

export interface BackupArchive {
  data: BackupData;
  photos: Map<string, Uint8Array>;
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupFormatError";
  }
}

// ---- sync.ts ----------------------------------------------------------------------------------

export function isSafeFileName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 200 &&
    !name.startsWith(".") &&
    !/[^A-Za-z0-9._-]/.test(name)
  );
}

export function rowKey(table: TableName, row: Row): string {
  const fields = row as unknown as Record<string, unknown>;
  return JSON.stringify(TABLES[table].columns.map((column) => fields[column] ?? null));
}

export function incomingWins(table: TableName, local: Row | null, incoming: Row): boolean {
  if (!local) return true;
  if (incoming.updatedAt !== local.updatedAt) return incoming.updatedAt > local.updatedAt;
  return rowKey(table, incoming) > rowKey(table, local);
}

// ---- backup.ts --------------------------------------------------------------------------------

export function photoFilesFor(rows: StoreRows): string[] {
  if (!Array.isArray(rows.photos)) throw new BackupFormatError("The backup is missing photos.");
  for (const photo of rows.photos) assertPhoto(photo);
  return (rows.photos as Photo[]).filter((p) => p.deletedAt === null).map((p) => p.fileName);
}

function assertPhoto(value: unknown): asserts value is Photo {
  if (typeof value !== "object" || value === null) {
    throw new BackupFormatError("Invalid photo record in backup.");
  }
  const photo = value as Record<string, unknown>;
  const optionalId = (field: unknown) =>
    field === undefined || field === null || (typeof field === "string" && field.trim() !== "");
  const ownerId = (field: unknown) => typeof field === "string" && field.trim() !== "";
  const conventionOwned = ownerId(photo.conventionId);
  if (
    typeof photo.id !== "string" ||
    !photo.id.trim() ||
    !optionalId(photo.pieceId) ||
    !optionalId(photo.conventionId) ||
    (conventionOwned
      ? photo.buildId !== null || ownerId(photo.pieceId)
      : !ownerId(photo.buildId)) ||
    typeof photo.createdAt !== "number" ||
    !Number.isFinite(photo.createdAt) ||
    typeof photo.updatedAt !== "number" ||
    !Number.isFinite(photo.updatedAt) ||
    (photo.deletedAt !== null &&
      (typeof photo.deletedAt !== "number" || !Number.isFinite(photo.deletedAt))) ||
    typeof photo.takenAt !== "number" ||
    !Number.isFinite(photo.takenAt) ||
    (photo.kind !== "progress" && photo.kind !== "reference" && photo.kind !== "cover") ||
    (photo.caption !== null && typeof photo.caption !== "string") ||
    typeof photo.fileName !== "string"
  ) {
    throw new BackupFormatError("Invalid photo record in backup.");
  }
  assertSafeFileName(photo.fileName);
}

export function assertSafeFileName(name: string): void {
  if (!isSafeFileName(name)) {
    throw new BackupFormatError(`Unsafe photo file name in backup: ${name}`);
  }
}

function validateArchivePhotos(archive: BackupArchive): void {
  const required = photoFilesFor(archive.data.rows);
  for (const name of archive.photos.keys()) assertSafeFileName(name);
  for (const name of required) {
    if (!archive.photos.has(name)) throw new BackupFormatError(`Missing photo: ${name}`);
  }
}

export function decodeBackup(bytes: Uint8Array): BackupArchive {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new BackupFormatError("This file is not a Cosapp.si backup.");
  }
  const json = files["data.json"];
  if (!json) throw new BackupFormatError("This file is not a Cosapp.si backup.");

  let data: BackupData;
  try {
    data = JSON.parse(strFromU8(json)) as BackupData;
  } catch {
    throw new BackupFormatError("The backup's data is unreadable.");
  }
  if (data.format !== BACKUP_FORMAT)
    throw new BackupFormatError("This file is not a Cosapp.si backup.");
  if (typeof data.schemaVersion !== "number" || data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupFormatError(
      "This backup was made by a newer version of the app. Update first."
    );
  }
  for (const table of TABLE_NAMES) {
    if (!Array.isArray(data.rows?.[table])) {
      throw new BackupFormatError(`The backup is missing ${table}.`);
    }
  }

  const photos = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith("photos/") || path.endsWith("/")) continue;
    const name = path.slice("photos/".length);
    assertSafeFileName(name);
    photos.set(name, content);
  }
  const archive = { data, photos };
  validateArchivePhotos(archive);
  return archive;
}

// ---- store/schema.ts constraints (what INSERT OR REPLACE would reject) ------------------------

const oneOf = (value: unknown, allowed: readonly string[]) =>
  typeof value === "string" && allowed.includes(value);
const isText = (value: unknown) => typeof value === "string";
const isInt = (value: unknown) => typeof value === "number" && Number.isInteger(value);
const nullable = (check: (value: unknown) => boolean) => (value: unknown) =>
  value === null || check(value);

const COLUMN_RULES: Record<TableName, Record<string, (value: unknown) => boolean>> = {
  builds: {
    character: isText,
    series: nullable(isText),
    status: (s) => oneOf(s, ["idea", "in_progress", "complete", "archived"]),
    targetDate: nullable(isText),
    targetLabel: nullable(isText),
    budgetCents: nullable(isInt),
    notes: nullable(isText),
  },
  pieces: {
    buildId: isText,
    name: isText,
    kind: (k) => oneOf(k, ["make", "buy"]),
    status: (s) => oneOf(s, ["todo", "in_progress", "done"]),
    costCents: nullable(isInt),
    link: nullable(isText),
    notes: nullable(isText),
    position: isInt,
  },
  tasks: {
    ownerKind: isText,
    buildId: nullable(isText),
    pieceId: nullable(isText),
    conventionId: nullable(isText),
    title: isText,
    done: (d) => typeof d === "boolean",
    dueDate: nullable(isText),
    remindAt: nullable(isInt),
    notes: nullable(isText),
    position: isInt,
  },
  photos: {
    buildId: nullable(isText),
    kind: (k) => oneOf(k, ["progress", "reference", "cover"]),
    fileName: isText,
    caption: nullable(isText),
    takenAt: isInt,
    pieceId: nullable(isText),
    conventionId: nullable(isText),
  },
  conventions: {
    name: isText,
    startDate: isText,
    endDate: isText,
    location: nullable(isText),
    badgeNote: nullable(isText),
    hotelNote: nullable(isText),
    notes: nullable(isText),
  },
  dayPlans: { conventionId: isText, date: isText, buildId: nullable(isText) },
  packingItems: {
    conventionId: isText,
    key: isText,
    label: isText,
    source: (s) => oneOf(s, ["generated", "manual"]),
    checked: (c) => typeof c === "boolean",
    buildId: nullable(isText),
    pieceId: nullable(isText),
    position: isInt,
  },
};

const ROW_CHECKS: Partial<Record<TableName, (row: Record<string, unknown>) => boolean>> = {
  tasks: (t) =>
    (t.ownerKind === "build" && t.buildId !== null && t.conventionId === null) ||
    (t.ownerKind === "convention" &&
      t.conventionId !== null &&
      t.buildId === null &&
      t.pieceId === null) ||
    (t.ownerKind === "none" && t.buildId === null && t.pieceId === null && t.conventionId === null),
  photos: (p) =>
    (p.buildId !== null && p.conventionId === null) ||
    (p.buildId === null && p.conventionId !== null && p.pieceId === null),
  conventions: (c) => (c.endDate as string) >= (c.startDate as string),
};

/** Throws the first row that Cosapp.si's SQLite store would reject (or a model invariant). */
export function assertStoreConstraints(rows: StoreRows): void {
  for (const table of TABLE_NAMES) {
    const ids = new Set<string>();
    for (const raw of rows[table]) {
      const row = raw as unknown as Record<string, unknown>;
      const where = `${table} ${String(row.id)}`;
      const keys = Object.keys(row).sort();
      const expected = [...TABLES[table].columns].sort();
      if (JSON.stringify(keys) !== JSON.stringify(expected)) {
        throw new Error(`${where}: columns ${keys.join(",")} ≠ ${expected.join(",")}`);
      }
      if (typeof row.id !== "string" || !row.id.trim() || ids.has(row.id)) {
        throw new Error(`${where}: missing or duplicate id`);
      }
      ids.add(row.id);
      if (!isInt(row.createdAt) || !isInt(row.updatedAt) || !nullable(isInt)(row.deletedAt)) {
        throw new Error(`${where}: invalid timestamps`);
      }
      for (const [column, check] of Object.entries(COLUMN_RULES[table])) {
        if (!check(row[column])) throw new Error(`${where}: invalid ${column}`);
      }
      if (ROW_CHECKS[table] && !ROW_CHECKS[table]!(row)) throw new Error(`${where}: CHECK failed`);
    }
  }
  // CREATE UNIQUE INDEX dayPlans_day ON dayPlans (conventionId, date), and the deterministic id.
  const days = new Set<string>();
  for (const plan of rows.dayPlans as unknown as Record<string, string>[]) {
    const key = `${plan.conventionId}:${plan.date}`;
    if (days.has(key) || plan.id !== key) throw new Error(`dayPlans ${plan.id}: bad day key`);
    days.add(key);
  }
}

/** `importBackup(store, archive, "merge")` over an in-memory store: rows written per table. */
export function mergeInto(
  store: Record<TableName, Map<string, Row>>,
  archive: BackupArchive
): Record<TableName, number> {
  validateArchivePhotos(archive);
  const applied = Object.fromEntries(TABLE_NAMES.map((t) => [t, 0])) as Record<TableName, number>;
  for (const table of TABLE_NAMES) {
    for (const row of archive.data.rows[table]) {
      if (!incomingWins(table, store[table].get(row.id) ?? null, row)) continue;
      store[table].set(row.id, row);
      applied[table] += 1;
    }
  }
  return applied;
}

export function emptyStore(): Record<TableName, Map<string, Row>> {
  return Object.fromEntries(TABLE_NAMES.map((t) => [t, new Map()])) as Record<
    TableName,
    Map<string, Row>
  >;
}
