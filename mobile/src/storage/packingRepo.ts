/**
 * Local packing list repository. Offline-first; anonymous users only.
 */

import type { PackingListItem, AddManualPackingItemInput } from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

const DEFAULT_GENERAL_ESSENTIALS = ["Wig cap", "Pins", "Glue", "Makeup wipes", "Repair tape"];

export async function getPacking(conventionId: string): Promise<PackingListItem[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string;
    convention_id: string;
    date: string | null;
    build_id: string | null;
    closet_item_id: string | null;
    label: string;
    checked: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at
     FROM packing_list_items WHERE convention_id = ? ORDER BY date ASC NULLS FIRST, label ASC`,
    [conventionId]
  );
  return rows.map((r) => ({
    id: r.id,
    conventionId: r.convention_id,
    date: r.date ?? null,
    buildId: r.build_id ?? null,
    cosplayNodeId: r.closet_item_id ?? null,
    closetItemId: r.closet_item_id ?? null,
    label: r.label,
    checked: r.checked !== 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function toggleChecked(packingItemId: string): Promise<PackingListItem | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ checked: number }>(
    `SELECT checked FROM packing_list_items WHERE id = ?`,
    [packingItemId]
  );
  if (!row) return null;
  const checked = row.checked === 0 ? 1 : 0;
  const updated_at = new Date().toISOString();
  await database.runAsync(
    `UPDATE packing_list_items SET checked = ?, updated_at = ? WHERE id = ?`,
    [checked, updated_at, packingItemId]
  );
  await enqueue("packing.toggle", { localId: packingItemId, checked: checked === 1 });
  const all = await database.getFirstAsync<{
    id: string;
    convention_id: string;
    date: string | null;
    build_id: string | null;
    closet_item_id: string | null;
    label: string;
    checked: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at FROM packing_list_items WHERE id = ?`,
    [packingItemId]
  );
  if (!all) return null;
  return {
    id: all.id,
    conventionId: all.convention_id,
    date: all.date ?? null,
    buildId: all.build_id ?? null,
    cosplayNodeId: all.closet_item_id ?? null,
    closetItemId: all.closet_item_id ?? null,
    label: all.label,
    checked: all.checked !== 0,
    createdAt: all.created_at,
    updatedAt: all.updated_at,
  };
}

export async function addManual(
  conventionId: string,
  input: AddManualPackingItemInput
): Promise<PackingListItem> {
  const database = await initClosetDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO packing_list_items (id, convention_id, date, build_id, label, checked, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, conventionId, input.date ?? null, input.buildId ?? null, input.label, now, now]
  );
  await enqueue("packing.addManual", {
    conventionLocalId: conventionId,
    label: input.label,
    date: input.date ?? undefined,
    buildLocalId: input.buildId ?? undefined,
  });
  return {
    id,
    conventionId,
    date: input.date ?? null,
    buildId: input.buildId ?? null,
    cosplayNodeId: null,
    closetItemId: null,
    label: input.label,
    checked: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Regenerate packing list locally: from day plan + build links, dedupe, add default general essentials if none. */
export async function regenerateLocal(conventionId: string): Promise<PackingListItem[]> {
  const database = await initClosetDb();
  const { getPlan } = await import("./plansRepo");
  const { getLinkedClosetItemIds } = await import("./buildsRepo");
  const { listItems } = await import("./closetRepo");

  const plan = await getPlan(conventionId);
  const closetItems = await listItems();
  const nameById = new Map(closetItems.map((c) => [c.id, c.name]));

  await database.runAsync(
    `DELETE FROM packing_list_items WHERE convention_id = ? AND closet_item_id IS NOT NULL`,
    [conventionId]
  );

  const seenCloset = new Set<string>();
  const now = new Date().toISOString();
  for (const p of plan) {
    if (!p.buildId) continue;
    const linkedIds = await getLinkedClosetItemIds(p.buildId);
    for (const cid of linkedIds) {
      if (seenCloset.has(cid)) continue;
      seenCloset.add(cid);
      const label = nameById.get(cid) ?? "Item";
      const id = crypto.randomUUID();
      await database.runAsync(
        `INSERT INTO packing_list_items (id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, conventionId, p.date, p.buildId, cid, label, now, now]
      );
    }
  }

  const generalCount = await database.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM packing_list_items WHERE convention_id = ? AND date IS NULL AND build_id IS NULL`,
    [conventionId]
  );
  if (generalCount && generalCount.c === 0) {
    for (const label of DEFAULT_GENERAL_ESSENTIALS) {
      const id = crypto.randomUUID();
      await database.runAsync(
        `INSERT INTO packing_list_items (id, convention_id, label, checked, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [id, conventionId, label, now, now]
      );
    }
  }

  await enqueue("packing.regenerate", { conventionLocalId: conventionId });
  return getPacking(conventionId);
}

export async function getPackingItemConvexId(localId: string): Promise<string | null> {
  const database = await initClosetDb();
  const row = await database.getFirstAsync<{ convex_id: string | null }>(
    `SELECT convex_id FROM packing_list_items WHERE id = ?`,
    [localId]
  );
  return row?.convex_id ?? null;
}

export async function setPackingItemConvexId(localId: string, convexId: string): Promise<void> {
  const database = await initClosetDb();
  await database.runAsync(`UPDATE packing_list_items SET convex_id = ? WHERE id = ?`, [
    convexId,
    localId,
  ]);
}
