/**
 * Sync-metadata maintenance for local-first writes (DATA_AND_SYNC.md §4, REQ-D40).
 *
 * Every local-first, user-owned write maintains:
 * - `version`        monotonically bumped per write (optimistic concurrency / LWW tiebreak).
 * - `updatedAt`      ms timestamp set on every field write (basis for pull deltas + row LWW).
 * - `fieldUpdatedAt` per-field ms timestamps for field-level last-write-wins (REQ-D40/D65).
 *
 * These run inside mutations only — never queries — so `Date.now()` is safe here.
 */

/** Fields that are identity/structure, not user-edited content; excluded from `fieldUpdatedAt`. */
const META_KEYS = new Set(["version", "updatedAt", "fieldUpdatedAt", "deletedAt", "clientId"]);

/**
 * Augment a new row's fields with create-time sync metadata. Spread into `ctx.db.insert(...)`:
 * `await ctx.db.insert("builds", withCreateMeta({ userId, name, ... }))`.
 */
export function withCreateMeta<T extends Record<string, unknown>>(
  fields: T,
  now: number = Date.now()
): T & { version: number; updatedAt: number; fieldUpdatedAt: Record<string, number> } {
  const fieldUpdatedAt: Record<string, number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && !META_KEYS.has(key)) fieldUpdatedAt[key] = now;
  }
  const existingVersion = fields.version;
  return {
    ...fields,
    version: typeof existingVersion === "number" ? existingVersion : 1,
    updatedAt: now,
    fieldUpdatedAt,
  };
}

/**
 * Augment a patch with update-time sync metadata: bump `version`, set `updatedAt`, and stamp
 * `fieldUpdatedAt` for each touched field (merged onto the row's prior per-field timestamps).
 * Spread into `ctx.db.patch(id, withUpdateMeta(existing, patch))`.
 */
export function withUpdateMeta<T extends Record<string, unknown>>(
  existing: { version?: number; fieldUpdatedAt?: Record<string, number> },
  patch: T,
  now: number = Date.now()
): T & { version: number; updatedAt: number; fieldUpdatedAt: Record<string, number> } {
  const fieldUpdatedAt: Record<string, number> = { ...(existing.fieldUpdatedAt ?? {}) };
  for (const key of Object.keys(patch)) {
    if (!META_KEYS.has(key)) fieldUpdatedAt[key] = now;
  }
  return {
    ...patch,
    version: (existing.version ?? 0) + 1,
    updatedAt: now,
    fieldUpdatedAt,
  };
}
