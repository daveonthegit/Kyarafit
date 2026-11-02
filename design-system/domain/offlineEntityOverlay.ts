/**
 * Shared, platform-agnostic logic for **optimistic visibility** of offline writes (local-first
 * plan, blueprint §3.13.2). Pure functions only — no SQLite/IndexedDB/Convex imports — so the
 * mobile and future web read paths overlay pending local writes onto the last server snapshot
 * identically, and the logic stays unit-testable in plain Node.
 *
 * A pending overlay row represents one not-yet-synced local write to an entity, keyed by its id
 * (the real server id for edits/deletes, or the optimistic `clientId` for offline-created rows):
 *   - `deleted: true`  → the entity was removed locally (tombstone).
 *   - `doc: {...}`      → fields to shallow-merge onto the entity (a full doc for a create, or just
 *                          the changed fields for an edit).
 *
 * Applying overlays to a query's last result lets the UI reflect offline writes before they sync;
 * once the sync worker drains and clears the overlay row, the live/cached server data takes over.
 */

export type EntityOverlayRow = {
  id: string;
  deleted: boolean;
  /** Fields to merge onto the entity. `null`/absent for pure deletes. */
  doc: Record<string, unknown> | null;
};

type WithId = { _id: string };

/**
 * Overlay pending local writes onto a list of documents (matched by `_id`). Existing rows are
 * merged in place (preserving base order); created rows (ids not in the base) are appended in
 * overlay order; deleted rows are removed. Returns a new array; inputs are not mutated.
 */
export function applyListOverlay<T extends WithId>(
  base: readonly T[],
  overlays: readonly EntityOverlayRow[]
): T[] {
  const byId = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  for (const doc of base) {
    byId.set(doc._id, { ...doc });
    order.push(doc._id);
  }
  for (const overlay of overlays) {
    if (overlay.deleted) {
      byId.delete(overlay.id);
      continue;
    }
    const existing = byId.get(overlay.id);
    if (existing) {
      byId.set(overlay.id, { ...existing, ...(overlay.doc ?? {}), _id: overlay.id });
    } else {
      byId.set(overlay.id, { ...(overlay.doc ?? {}), _id: overlay.id });
      order.push(overlay.id);
    }
  }
  const result: T[] = [];
  for (const id of order) {
    const doc = byId.get(id);
    if (doc) result.push(doc as T);
  }
  return result;
}

/**
 * Overlay pending local writes onto a single document. `targetId` identifies the document being
 * viewed (from the base doc, or the query arg when the base is missing — e.g. an offline-created
 * row the server has never seen). A delete overlay yields `null`; an edit/create overlay merges.
 * When the base is `undefined` (loading) and no overlay matches, `undefined` is preserved.
 */
export function applyDocOverlay<T extends WithId>(
  base: T | null | undefined,
  overlays: readonly EntityOverlayRow[],
  targetId: string | undefined
): T | null | undefined {
  const id = base?._id ?? targetId;
  if (id == null) return base;
  let result: Record<string, unknown> | null | undefined =
    base === undefined ? undefined : base === null ? null : { ...base };
  for (const overlay of overlays) {
    if (overlay.id !== id) continue;
    if (overlay.deleted) {
      result = null;
    } else {
      result = { ...(result ?? {}), ...(overlay.doc ?? {}), _id: id };
    }
  }
  return result as T | null | undefined;
}
