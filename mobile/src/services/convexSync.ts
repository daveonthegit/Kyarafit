/**
 * Convex sync service — offline-first, two-phase sync.
 *
 * PUSH  (SQLite → Convex): drains the outbox by calling Convex mutations.
 *        All IDs in outbox payloads are local SQLite UUIDs; this service
 *        translates them to Convex IDs via each table's convex_id column.
 *
 * PULL  (Convex → SQLite): accepts already-fetched Convex query results
 *        (from React useQuery hooks) and upserts them into SQLite, keeping
 *        convex_id columns in sync so future pushes can update correctly.
 *
 * Ordering matters for push: closet items → builds → build tasks →
 * build links → conventions → day plans → packing.
 */

import type { ConvexReactClient } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { listPending, remove as removeEntry } from "../storage/outboxRepo";
import { getDb } from "../storage/db";
import * as closetRepo from "../storage/closetRepo";
import * as buildsRepo from "../storage/buildsRepo";
import * as buildTasksRepo from "../storage/buildTasksRepo";
import * as conventionsRepo from "../storage/conventionsRepo";
import { setPackingItemConvexId } from "../storage/packingRepo";
import { setPlan } from "../storage/plansRepo";

// ─── Types from Convex query results ─────────────────────────────────────────

export interface ConvexClosetItem {
  _id: string;
  name: string;
  category: string;
  tags: string[];
  notes?: string;
  imageUrl?: string;
  costCents?: number;
  userId: string;
}

export interface ConvexBuildTask {
  _id: string;
  buildId: string;
  label: string;
  sortOrder: number;
  checked: boolean;
  cosplayNodeId?: string;
  closetItemId?: string;
  dueDate?: string;
}

export interface ConvexBuildWithDetails {
  _id: string;
  name: string;
  character?: string;
  status: string;
  notes?: string;
  imageUrl?: string;
  budgetCents?: number;
  targetDate?: string;
  userId: string;
  tasks: ConvexBuildTask[];
  workflowItems?: Array<{
    _id: string;
    title: string;
    status: string;
    sortOrder: number;
    dueDate?: string;
  }>;
  linkedItemIds?: string[];
  linkedNodeIds?: string[];
}

export interface ConvexPackingItem {
  _id: string;
  conventionId: string;
  label: string;
  checked: boolean;
  date?: string;
  buildId?: string;
  cosplayNodeId?: string;
  closetItemId?: string;
  workflowItemId?: string;
  entryKind?: string;
  sourceKind?: string;
  sortOrder?: number;
}

export interface ConvexDayPlan {
  _id: string;
  conventionId: string;
  date: string;
  buildId?: string;
  notes?: string;
}

export interface ConvexConventionWithDetails {
  _id: string;
  name: string;
  location?: string;
  startDate: string;
  endDate: string;
  userId: string;
  plans: ConvexDayPlan[];
  packing: ConvexPackingItem[];
}

export interface SyncResult {
  processed: number;
  skipped: number;
  errors: string[];
}

// ─── Helper: get/set convex_id via raw DB access ─────────────────────────────

async function getConvexIdFromTable(table: string, localId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const row = await db.getFirstAsync<{ convex_id: string | null }>(
    `SELECT convex_id FROM ${table} WHERE id = ?`,
    [localId]
  );
  return row?.convex_id ?? null;
}

async function setConvexIdInTable(table: string, localId: string, convexId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.runAsync(`UPDATE ${table} SET convex_id = ? WHERE id = ?`, [convexId, localId]);
}

// ─── PUSH ─────────────────────────────────────────────────────────────────────

/**
 * Drains the outbox, calling Convex mutations for each pending entry.
 * Safe to call multiple times — already-processed entries are removed.
 * Entries that depend on unsynced parents (e.g. build task before build) are
 * skipped and retried on the next call once the parent is pushed first.
 */
export async function pushToConvex(client: ConvexReactClient, userId: string): Promise<SyncResult> {
  const entries = await listPending();
  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      const payload = JSON.parse(entry.payload_json);

      switch (entry.type) {
        // ── Closet items ──────────────────────────────────────────────────
        case "closetItem.upsert": {
          const { localId, name, category, tags, notes, imageUrl, costCents } = payload;
          const existingId = await getConvexIdFromTable("closet_items", localId);
          if (existingId) {
            await client.mutation(api.closetItems.update, {
              id: existingId as Id<"closetItems">,
              userId,
              name,
              category,
              tags,
              notes,
              imageUrl,
              costCents,
            });
          } else {
            const result = await client.mutation(api.closetItems.create, {
              userId,
              name,
              category,
              tags,
              notes,
              imageUrl,
              costCents,
            });
            if (result) await setConvexIdInTable("closet_items", localId, result._id);
          }
          break;
        }

        case "closetItem.delete": {
          const { localId } = payload;
          const convexId = await getConvexIdFromTable("closet_items", localId);
          if (convexId) {
            await client.mutation(api.closetItems.remove, {
              id: convexId as Id<"closetItems">,
              userId,
            });
          }
          break;
        }

        // ── Builds ────────────────────────────────────────────────────────
        case "build.upsert": {
          const { localId, name, character, status, notes, imageUrl, budgetCents, targetDate } =
            payload;
          const existingId = await getConvexIdFromTable("builds", localId);
          if (existingId) {
            await client.mutation(api.builds.update, {
              id: existingId as Id<"builds">,
              userId,
              name,
              character,
              status,
              notes,
              imageUrl,
              budgetCents,
              targetDate,
            });
          } else {
            const result = await client.mutation(api.builds.create, {
              userId,
              name,
              character,
              status,
              notes,
              imageUrl,
              budgetCents,
              targetDate,
            });
            if (result) await setConvexIdInTable("builds", localId, result._id);
          }
          break;
        }

        case "build.delete": {
          const { localId } = payload;
          const convexId = await getConvexIdFromTable("builds", localId);
          if (convexId) {
            await client.mutation(api.builds.remove, {
              id: convexId as Id<"builds">,
              userId,
            });
          }
          break;
        }

        case "build.linkItems": {
          const { buildLocalId, closetItemLocalIds } = payload;
          const buildConvexId = await getConvexIdFromTable("builds", buildLocalId);
          if (!buildConvexId) {
            // Build not yet pushed — skip, retry next time
            skipped++;
            continue;
          }
          const convexItemIds: Id<"closetItems">[] = [];
          for (const lid of closetItemLocalIds as string[]) {
            const cid = await getConvexIdFromTable("closet_items", lid);
            if (cid) convexItemIds.push(cid as Id<"closetItems">);
          }
          await client.mutation(api.builds.linkItems, {
            userId,
            buildId: buildConvexId as Id<"builds">,
            closetItemIds: convexItemIds,
          });
          break;
        }

        // ── Build tasks ───────────────────────────────────────────────────
        case "workflowItem.upsert": {
          const { localId, buildLocalId, title, sortOrder, status, closetItemLocalId, dueDate } =
            payload;
          const buildConvexId = await getConvexIdFromTable("builds", buildLocalId);
          if (!buildConvexId) {
            skipped++;
            continue;
          }
          let closetItemId: Id<"closetItems"> | undefined;
          if (closetItemLocalId) {
            const cid = await getConvexIdFromTable("closet_items", closetItemLocalId);
            if (cid) closetItemId = cid as Id<"closetItems">;
          }
          const existingId = await getConvexIdFromTable("workflow_items", localId);
          if (existingId) {
            await client.mutation(api.buildTasks.update, {
              id: existingId as Id<"workflowItems">,
              userId,
              label: title,
              sortOrder,
              checked: status === "done",
              closetItemId,
              dueDate,
            });
          } else {
            const result = await client.mutation(api.buildTasks.create, {
              userId,
              buildId: buildConvexId as Id<"builds">,
              label: title,
              sortOrder,
              closetItemId,
              dueDate,
            });
            if (result) await setConvexIdInTable("workflow_items", localId, result._id);
          }
          break;
        }

        case "workflowItem.delete": {
          const { localId } = payload;
          const convexId = await getConvexIdFromTable("workflow_items", localId);
          if (convexId) {
            await client.mutation(api.buildTasks.remove, {
              id: convexId as Id<"workflowItems">,
              userId,
            });
          }
          break;
        }

        // ── Conventions ───────────────────────────────────────────────────
        case "convention.upsert": {
          const { localId, name, location, startDate, endDate } = payload;
          const existingId = await getConvexIdFromTable("conventions", localId);
          if (existingId) {
            await client.mutation(api.conventions.update, {
              id: existingId as Id<"conventions">,
              userId,
              name,
              location,
              startDate,
              endDate,
            });
          } else {
            const result = await client.mutation(api.conventions.create, {
              userId,
              name,
              location,
              startDate,
              endDate,
            });
            if (result) await setConvexIdInTable("conventions", localId, result._id);
          }
          break;
        }

        case "convention.delete": {
          const { localId } = payload;
          const convexId = await getConvexIdFromTable("conventions", localId);
          if (convexId) {
            await client.mutation(api.conventions.remove, {
              id: convexId as Id<"conventions">,
              userId,
            });
          }
          break;
        }

        case "convention.plan.replace": {
          const { conventionLocalId, plan } = payload;
          const conventionConvexId = await getConvexIdFromTable("conventions", conventionLocalId);
          if (!conventionConvexId) {
            skipped++;
            continue;
          }
          const translatedPlan = await Promise.all(
            (plan as Array<{ date: string; buildLocalId?: string | null; notes?: string }>).map(
              async (entry) => {
                let buildId: Id<"builds"> | undefined;
                if (entry.buildLocalId) {
                  const bc = await getConvexIdFromTable("builds", entry.buildLocalId);
                  if (bc) buildId = bc as Id<"builds">;
                }
                return { date: entry.date, buildId, notes: entry.notes };
              }
            )
          );
          await client.mutation(api.conventions.replacePlan, {
            userId,
            conventionId: conventionConvexId as Id<"conventions">,
            plan: translatedPlan,
          });
          break;
        }

        case "packing.toggle": {
          const { localId, checked } = payload;
          const convexId = await getConvexIdFromTable("packing_list_items", localId);
          if (!convexId) {
            // Item not yet synced — skip until pull brings it in
            skipped++;
            continue;
          }
          await client.mutation(api.conventions.updatePackingItem, {
            id: convexId as Id<"packingListItems">,
            userId,
            checked,
          });
          break;
        }

        case "packing.addManual": {
          const { conventionLocalId, label, date, buildLocalId } = payload;
          const conventionConvexId = await getConvexIdFromTable("conventions", conventionLocalId);
          if (!conventionConvexId) {
            skipped++;
            continue;
          }
          let buildId: Id<"builds"> | undefined;
          if (buildLocalId) {
            const bc = await getConvexIdFromTable("builds", buildLocalId);
            if (bc) buildId = bc as Id<"builds">;
          }
          await client.mutation(api.conventions.addManualPackingItem, {
            userId,
            conventionId: conventionConvexId as Id<"conventions">,
            label,
            date,
            buildId,
          });
          break;
        }

        case "packing.regenerate": {
          const { conventionLocalId } = payload;
          const conventionConvexId = await getConvexIdFromTable("conventions", conventionLocalId);
          if (!conventionConvexId) {
            skipped++;
            continue;
          }
          await client.mutation(api.conventions.regeneratePacking, {
            userId,
            conventionId: conventionConvexId as Id<"conventions">,
          });
          break;
        }

        default:
          break;
      }

      await removeEntry(entry.id);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${entry.type}#${entry.id}]: ${msg}`);
      // Don't remove the entry — it stays in the outbox for retry
    }
  }

  return { processed, skipped, errors };
}

// ─── PULL ─────────────────────────────────────────────────────────────────────

/** Upserts Convex closet items into SQLite. */
export async function pullClosetItems(items: ConvexClosetItem[]): Promise<void> {
  for (const item of items) {
    await closetRepo.upsertFromConvex({
      id: item._id,
      name: item.name,
      category: item.category as never,
      tags: item.tags ?? [],
      notes: item.notes,
      imageUrl: item.imageUrl,
      costCents: item.costCents,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      convexId: item._id,
    });
  }
}

/** Upserts Convex builds (with tasks and links) into SQLite. */
export async function pullBuilds(builds: ConvexBuildWithDetails[]): Promise<void> {
  const db = getDb();
  for (const build of builds) {
    // Use the Convex _id as local id for Convex-originated records
    await buildsRepo.upsertFromConvex({
      id: build._id,
      name: build.name,
      character: build.character,
      status: build.status as never,
      notes: build.notes,
      imageUrl: build.imageUrl,
      budgetCents: build.budgetCents,
      targetDate: build.targetDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      convexId: build._id,
    });

    // Sync build workflow items through the local workflow tables.
    if (db) {
      for (const task of build.tasks) {
        await buildTasksRepo.upsertFromSync({
          id: task._id,
          buildId: build._id,
          label: task.label,
          closetItemId: task.cosplayNodeId ?? task.closetItemId ?? undefined,
          cosplayNodeId: task.cosplayNodeId ?? task.closetItemId ?? undefined,
          sortOrder: task.sortOrder,
          checked: task.checked,
          dueDate: task.dueDate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await buildTasksRepo.setConvexId(task._id, task._id);
      }

      // Sync item links: replace the whole set for this build
      await db.runAsync(`DELETE FROM build_item_links WHERE build_id = ?`, [build._id]);
      const linkedIds = build.linkedNodeIds ?? build.linkedItemIds ?? [];
      for (const closetItemConvexId of linkedIds) {
        // Resolve to local closet item id (which equals closetItemConvexId for Convex-origin items)
        await db.runAsync(
          `INSERT OR IGNORE INTO build_item_links (build_id, closet_item_id) VALUES (?, ?)`,
          [build._id, closetItemConvexId]
        );
      }
    }
  }
}

/** Upserts Convex conventions (with plans and packing) into SQLite. */
export async function pullConventions(conventions: ConvexConventionWithDetails[]): Promise<void> {
  const db = getDb();
  for (const convention of conventions) {
    await conventionsRepo.upsertFromConvex({
      id: convention._id,
      name: convention.name,
      location: convention.location,
      startDate: convention.startDate,
      endDate: convention.endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      convexId: convention._id,
    });

    // Sync day plans (replace the whole set)
    if (db && convention.plans.length > 0) {
      const planEntries = await Promise.all(
        convention.plans.map(async (p) => ({
          date: p.date,
          // buildId in plan may be a Convex build ID; use as-is (it matches local id for Convex-origin builds)
          buildId: p.buildId ?? null,
          notes: p.notes,
        }))
      );
      // Use setPlan but skip the outbox enqueue — we're pulling from Convex
      if (db) {
        await db.runAsync(`DELETE FROM convention_day_plans WHERE convention_id = ?`, [
          convention._id,
        ]);
        for (const entry of planEntries) {
          const planId = Math.random().toString(36).slice(2);
          await db.runAsync(
            `INSERT INTO convention_day_plans (id, convention_id, date, build_id, notes) VALUES (?, ?, ?, ?, ?)`,
            [planId, convention._id, entry.date, entry.buildId, entry.notes ?? null]
          );
        }
      }
    }

    // Sync packing items (replace the whole set)
    if (db) {
      await db.runAsync(`DELETE FROM packing_list_items WHERE convention_id = ?`, [convention._id]);
      const now = new Date().toISOString();
      for (const item of convention.packing) {
        await db.runAsync(
          `INSERT INTO packing_list_items (id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at, convex_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item._id,
            convention._id,
            item.date ?? null,
            item.buildId ?? null,
            item.cosplayNodeId ?? item.closetItemId ?? null,
            item.label,
            item.checked ? 1 : 0,
            now,
            now,
            item._id,
          ]
        );
        await db.runAsync(`UPDATE packing_list_items SET workflow_item_id = ? WHERE id = ?`, [
          item.workflowItemId ?? null,
          item._id,
        ]);
      }
    }
  }
}
