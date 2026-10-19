import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { Directory, File } from "expo-file-system";
import { collectVaultImageKeys, toPortableImageRefs, vaultImageDir } from "@/vault/images";
import * as FileSystem from "expo-file-system/legacy";
import { migrateVaultSchema } from "./vaultSchema";

/**
 * Per-account local vault database (offline-first Phase 1).
 *
 * Every signed-in account gets its own SQLite file, `kyarafit-vault-<vaultKey>.db`. The file is the
 * authoritative home of that account's personal data (builds, elements, conventions, packing/day
 * plans, photo references) whether online or offline, free or paid. Exactly one vault is open at a
 * time; with no vault open (signed out / locked) `getOfflineDb()` throws `VaultLockedError` instead of
 * silently opening a shared database, so one account can never read or replay another's rows.
 *
 * Sign-out LOCKS the vault (closes the file); it never deletes it. Deleting a vault is a separate,
 * explicit user action (`deleteVaultDatabase`).
 */

const LEGACY_DB_NAME = "kyarafit.db";
const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Soft cap for the disposable query cache only. Authoritative rows and queued work are never evicted. */
export const OFFLINE_QUERY_CACHE_CAP_BYTES = 20 * MB;
export const OFFLINE_TOMBSTONE_RETENTION_MS = 30 * DAY_MS;

/** Thrown when personal data is touched while no account vault is unlocked. */
export class VaultLockedError extends Error {
  constructor() {
    super("No local vault is open. Sign in to unlock this device's data.");
    this.name = "VaultLockedError";
  }
}

let _db: SQLiteDatabase | null = null;
let _vaultKey: string | null = null;

/** FNV-1a 32-bit — a stable, dependency-free suffix that keeps sanitized keys collision-safe. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** File-system-safe, stable key for an account subject. */
export function vaultKeyForSubject(subject: string): string {
  const safe = subject.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48);
  return `${safe}-${fnv1a(subject)}`;
}

export function vaultDatabaseName(subject: string): string {
  return `kyarafit-vault-${vaultKeyForSubject(subject)}.db`;
}

export function vaultExportFilePath(subject: string): string | null {
  const docs = FileSystem.documentDirectory;
  return docs ? `${docs}kyarafit-export-${vaultKeyForSubject(subject)}.json` : null;
}

/**
 * Before vaults were partitioned, the app kept one shared `kyarafit.db` that sign-out deleted, so a
 * surviving legacy file always belongs to the account that is still signed in. Adopt its rows into
 * that account's vault once (only when every row is either unowned or owned by this subject), then
 * remove it.
 */
function adoptLegacyDatabase(db: SQLiteDatabase, subject: string): void {
  const docs = FileSystem.documentDirectory;
  if (!docs) return;
  const legacyPath = `${docs}SQLite/${LEGACY_DB_NAME}`;
  // ATTACH would create an empty file when there is nothing to adopt (the common case).
  if (!new File(legacyPath).exists) return;
  let attached = false;
  try {
    const adopted = db.getFirstSync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'vault:legacyAdopted'"
    );
    if (adopted) return;
    db.execSync(
      `ATTACH DATABASE '${legacyPath.replace(/^file:\/\//, "").replace(/'/g, "''")}' AS legacy`
    );
    attached = true;
    const tables = db.getAllSync<{ name: string }>(
      "SELECT name FROM legacy.sqlite_master WHERE type = 'table' AND name = 'entity_rows'"
    );
    if (tables.length > 0) {
      const foreign = db.getFirstSync<{ c: number }>(
        "SELECT COUNT(*) AS c FROM legacy.entity_rows WHERE user_id <> '' AND user_id <> ?",
        [subject]
      );
      if ((foreign?.c ?? 0) > 0) return;
      const legacyRows = db.getAllSync<{
        table_name: string;
        id: string;
        user_id: string;
        json: string;
        updated_at: number;
        synced_at: number | null;
        deleted: number;
      }>("SELECT * FROM legacy.entity_rows ORDER BY synced_at IS NULL, updated_at");
      const required: Record<string, Record<string, string>> = {
        builds: { name: "string", status: "string" },
        cosplayNodes: { name: "string", nodeType: "string" },
        conventions: { name: "string", startDate: "string", endDate: "string" },
        workflowItems: {
          title: "string",
          kind: "string",
          status: "string",
          category: "string",
          ancestorIds: "array",
          sortOrder: "number",
          scopeKind: "string",
          sourceKind: "string",
        },
        workflowAttachments: {
          workflowItemId: "string",
          entityType: "string",
          entityId: "string",
          entityKey: "string",
          role: "string",
        },
        workflowDependencies: {
          predecessorWorkflowItemId: "string",
          successorWorkflowItemId: "string",
          relationKind: "string",
        },
        buildTasks: { label: "string", sortOrder: "number", checked: "boolean" },
        conventionDayPlans: { conventionId: "string", date: "string" },
        packingListItems: { conventionId: "string", label: "string", checked: "boolean" },
        buildReferenceImages: { buildId: "string", sortOrder: "number" },
        buildProcessPictures: { buildId: "string", sortOrder: "number" },
        buildProgressUpdates: {
          buildId: "string",
          createdAt: "number",
          imageRefs: "array",
          publishedToFeed: "boolean",
        },
      };
      const recovered = new Map<string, (typeof legacyRows)[number]>();
      let incomplete = false;
      for (const row of legacyRows) {
        const key = JSON.stringify([row.table_name, row.id]);
        try {
          const overlay = JSON.parse(row.json);
          if (!overlay || typeof overlay !== "object" || Array.isArray(overlay))
            throw new Error("Invalid document");
          const prior = recovered.get(key);
          const doc =
            row.synced_at === null && prior ? { ...JSON.parse(prior.json), ...overlay } : overlay;
          recovered.set(key, { ...row, json: JSON.stringify(toPortableImageRefs(doc)) });
        } catch {
          incomplete = true;
          console.warn(
            `[vault] incomplete legacy recovery: ${row.table_name}/${row.id}; legacy database retained`
          );
        }
      }
      for (const row of recovered.values()) {
        if (row.deleted) continue;
        const doc = JSON.parse(row.json);
        const fields = required[row.table_name];
        if (
          !fields ||
          Object.entries({ userId: "string", ...fields }).some(([field, type]) =>
            type === "array" ? !Array.isArray(doc[field]) : typeof doc[field] !== type
          )
        ) {
          incomplete = true;
          console.warn(
            `[vault] incomplete legacy recovery: ${row.table_name}/${row.id}; legacy database retained`
          );
        }
      }
      if (incomplete) {
        throw new Error(
          "Incomplete legacy recovery. The original database has been retained. Retry after resolving the incomplete records."
        );
      }
      const keys = collectVaultImageKeys(
        [...recovered.values()].filter((row) => !row.deleted).map((row) => JSON.parse(row.json))
      );
      const imageDir = new Directory(vaultImageDir(docs, vaultKeyForSubject(subject)));
      if (keys.size > 0 && !imageDir.exists)
        imageDir.create({ intermediates: true, idempotent: true });
      for (const key of keys) {
        const original = new File(`${docs}local-images/${key}`);
        const target = new File(imageDir, key);
        if (original.exists && !target.exists) original.copy(target);
      }
      db.withTransactionSync(() => {
        for (const row of recovered.values()) {
          db.runSync(
            `INSERT OR IGNORE INTO entity_rows (table_name, id, user_id, json, updated_at, synced_at, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              row.table_name,
              row.id,
              row.user_id,
              row.json,
              row.updated_at,
              row.synced_at,
              row.deleted,
            ]
          );
        }
        db.execSync(`
          INSERT OR IGNORE INTO id_map SELECT * FROM legacy.id_map;
          INSERT OR IGNORE INTO mutation_queue
            (idempotency_key, op, fn, args_json, base_version, client_id, retry_count, created_at, status)
            SELECT idempotency_key, op, fn, args_json, base_version, client_id, retry_count, created_at, status
            FROM legacy.mutation_queue;
        `);
        const queued = db.getAllSync<{ id: number; args_json: string }>(
          "SELECT id, args_json FROM mutation_queue"
        );
        for (const row of queued) {
          db.runSync("UPDATE mutation_queue SET args_json = ? WHERE id = ?", [
            JSON.stringify(toPortableImageRefs(JSON.parse(row.args_json))),
            row.id,
          ]);
        }
        db.runSync(
          "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('vault:legacyAdopted', ?)",
          [String(Date.now())]
        );
      });
    }
    db.execSync("DETACH DATABASE legacy");
    attached = false;
    deleteDatabaseSync(LEGACY_DB_NAME);
  } catch (error) {
    console.warn("[vault] legacy recovery failed; legacy database retained", error);
    throw error;
  } finally {
    if (attached) {
      try {
        db.execSync("DETACH DATABASE legacy");
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Open (unlock) the vault for `subject`, closing any other account's vault first. Throws if the
 * database cannot be opened or migrated — callers must surface that, never fall back to a shared DB.
 */
export function openVaultDatabase(subject: string): SQLiteDatabase {
  const key = vaultKeyForSubject(subject);
  if (_db && _vaultKey === key) return _db;
  closeVaultDatabase();
  const db = openDatabaseSync(vaultDatabaseName(subject));
  try {
    migrateVaultSchema(db, subject);
    adoptLegacyDatabase(db, subject);
  } catch (error) {
    try {
      db.closeSync();
    } catch {
      /* ignore */
    }
    throw error;
  }
  _db = db;
  _vaultKey = key;
  return db;
}

/** Lock the open vault (sign-out / account switch). Never deletes data. */
export function closeVaultDatabase(): void {
  if (_db) {
    try {
      _db.closeSync();
    } catch {
      /* ignore */
    }
  }
  _db = null;
  _vaultKey = null;
}

/** The open vault's key, or null when locked. */
export function getOpenVaultKey(): string | null {
  return _vaultKey;
}

export function isVaultOpen(): boolean {
  return _db !== null;
}

/** The open vault database. Throws `VaultLockedError` when no account vault is unlocked. */
export function getOfflineDb(): SQLiteDatabase {
  if (!_db) throw new VaultLockedError();
  return _db;
}

/**
 * Explicit, destructive "remove this device's data" for one account. Only ever called from a
 * confirmed user action — sign-out and account switch never call it.
 */
export async function deleteVaultDatabase(subject: string): Promise<void> {
  const key = vaultKeyForSubject(subject);
  if (_vaultKey === key) closeVaultDatabase();
  deleteDatabaseSync(vaultDatabaseName(subject));
  const docs = FileSystem.documentDirectory;
  if (docs) {
    await FileSystem.deleteAsync(`${docs}vaults/${key}/`, { idempotent: true });
  }
  const exportPath = vaultExportFilePath(subject);
  if (exportPath) await FileSystem.deleteAsync(exportPath, { idempotent: true });
}

function queryCacheBytes(db: SQLiteDatabase): number {
  const row = db.getFirstSync<{ bytes: number | null }>(
    "SELECT SUM(LENGTH(query_key) + LENGTH(payload_json)) AS bytes FROM query_cache"
  );
  return row?.bytes ?? 0;
}

/**
 * Drop synced tombstones past the retention window. Pending tombstones (deletes not yet replicated)
 * are never touched. Best-effort maintenance; a locked vault is a no-op.
 */
export function pruneOfflineTombstones(
  cutoffMs = Date.now() - OFFLINE_TOMBSTONE_RETENTION_MS
): void {
  if (!_db) return;
  try {
    _db.runSync(
      `DELETE FROM entity_rows
       WHERE deleted = 1 AND synced_at IS NOT NULL AND synced_at <= ?`,
      [Math.floor(cutoffMs)]
    );
  } catch (error) {
    console.warn("[vault] tombstone prune failed", error);
  }
}

/**
 * Bound the disposable online-query cache (oldest first). Authoritative vault rows, the replication
 * queue and live id mappings are NEVER evicted — when the device is out of space a new write fails
 * loudly instead of silently dropping earlier work.
 */
export function enforceOfflineStorageCaps(): void {
  if (!_db) return;
  try {
    let bytes = queryCacheBytes(_db);
    while (bytes > OFFLINE_QUERY_CACHE_CAP_BYTES) {
      const removed = _db.runSync(
        `DELETE FROM query_cache WHERE query_key IN (
           SELECT query_key FROM query_cache ORDER BY fetched_at ASC LIMIT 100
         )`
      );
      if ((removed.changes ?? 0) === 0) break;
      bytes = queryCacheBytes(_db);
    }
  } catch (error) {
    console.warn("[vault] cache maintenance failed", error);
  }
}
