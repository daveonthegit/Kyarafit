import { api } from "convex/_generated/api";
import { LOCAL_ID_PREFIX } from "@kyarafit/design-system/domain/offlineIdMap";
import { getOfflineDb } from "@/offline/db";
import { getIsOnline } from "@/offline/connectivity";
import { NeedsConnectionError } from "@/offline/useOfflineMutation";
import { isVaultImageValue } from "./images";
import type { VaultPersistHook, VaultSql } from "./store";

/**
 * Published server copies of vault rows (DATA_AND_SYNC.md §6.4).
 *
 * Social features (collaborators, groups) need a server copy of a build or convention. That copy is
 * a PROJECTION the owner publishes explicitly (`publications:publish`), never a second editable
 * copy: nothing flows back from it into the vault. `id_map` records which server row each vault
 * row was published as (and, for vaults that used the legacy sync, which cloud row it mirrors).
 *
 * Deleting a published vault row queues removal of its server copy in the same transaction; the
 * removal runs once online (`flushPublicationRemovals`), so a deleted build never stays public.
 */

export type PublishableTable = "builds" | "conventions";

/** Content fields a projection carries; social settings stay on the server copy. */
const PUBLISHED_FIELDS: Record<PublishableTable, readonly string[]> = {
  builds: [
    "name",
    "character",
    "status",
    "notes",
    "imageUrl",
    "imageFocalX",
    "imageFocalY",
    "budgetCents",
    "targetDate",
    "manualProgressPercent",
  ],
  conventions: ["name", "location", "imageUrl", "startDate", "endDate", "archived"],
};

function isPublishable(table: string): table is PublishableTable {
  return table === "builds" || table === "conventions";
}

/** The server copy a vault row maps to (its own id for rows first pulled from the cloud). */
function serverIdFor(sql: VaultSql, id: string): string | null {
  if (!id.startsWith(LOCAL_ID_PREFIX)) return id;
  return (
    sql.getFirstSync<{ server_id: string }>("SELECT server_id FROM id_map WHERE client_id = ?", [
      id,
    ])?.server_id ?? null
  );
}

/** `onPersist` hook: queue removal of the server copy of every deleted published row. */
export const recordPublicationRemovals: VaultPersistHook = (sql, changes) => {
  for (const change of changes) {
    if (change.after || !isPublishable(change.table)) continue;
    const serverId = serverIdFor(sql, change.id);
    if (!serverId) continue;
    sql.runSync(
      `INSERT INTO publish_removals (client_id, table_name, server_id) VALUES (?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET server_id = excluded.server_id`,
      [change.id, change.table, serverId]
    );
  }
};

/** The published server id for a vault row, or null when it has never been published. */
export function getPublishedId(localId: string): string | null {
  try {
    return serverIdFor(getOfflineDb(), localId);
  } catch {
    return null;
  }
}

/** The vault row a published server id belongs to (deep links that carry a server id). */
export function getLocalIdForPublished(serverId: string): string | null {
  try {
    return (
      getOfflineDb().getFirstSync<{ client_id: string }>(
        "SELECT client_id FROM id_map WHERE server_id = ? LIMIT 1",
        [serverId]
      )?.client_id ?? null
    );
  } catch {
    return null;
  }
}

/** The projection of a stored vault row: whitelisted content, no device-only photo tokens. */
export function publishedProjection(
  table: PublishableTable,
  doc: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of PUBLISHED_FIELDS[table]) {
    const value = doc[field];
    if (value === undefined || value === null) continue;
    // A vault photo is a device file; publishing photos is a separate, explicit media upload.
    if (field === "imageUrl" && (isVaultImageValue(value) || typeof value !== "string")) continue;
    out[field] = value;
  }
  return out;
}

export interface PublicationClient {
  mutation(reference: unknown, args: unknown): Promise<unknown>;
}

/**
 * Publish (or refresh) the server copy of a vault build or convention and return its server id.
 * Requires a connection (rejects with `NeedsConnectionError` offline); the caller surfaces failures.
 */
export async function publishVaultRow(
  client: PublicationClient,
  table: PublishableTable,
  localId: string,
  sql: VaultSql = getOfflineDb()
): Promise<string> {
  if (!getIsOnline()) throw new NeedsConnectionError();
  const row = sql.getFirstSync<{ json: string }>(
    "SELECT json FROM entity_rows WHERE table_name = ? AND id = ? AND deleted = 0",
    [table, localId]
  );
  if (!row) throw new Error("This item is no longer on this device.");
  const doc = JSON.parse(row.json) as Record<string, unknown>;
  const { id } = (await client.mutation(api.publications.publish, {
    table,
    clientId: localId,
    doc: publishedProjection(table, doc),
  })) as { id: string };
  if (localId.startsWith(LOCAL_ID_PREFIX)) {
    sql.runSync(
      `INSERT INTO id_map (client_id, server_id, synced_at) VALUES (?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET server_id = excluded.server_id,
         synced_at = excluded.synced_at`,
      [localId, id, Date.now()]
    );
  }
  return id;
}

/**
 * Remove the server copies of deleted vault rows (idempotent server-side, so a retry after a lost
 * response is safe). Failures stay queued for the next call. Makes no call when nothing was ever
 * published.
 */
export async function flushPublicationRemovals(
  client: PublicationClient,
  sql: VaultSql = getOfflineDb()
): Promise<number> {
  const pending = sql.getAllSync<{ client_id: string; table_name: string; server_id: string }>(
    "SELECT client_id, table_name, server_id FROM publish_removals"
  );
  let removed = 0;
  for (const entry of pending) {
    try {
      await client.mutation(api.publications.unpublish, {
        table: entry.table_name === "conventions" ? "conventions" : "builds",
        serverId: entry.server_id,
      });
    } catch {
      continue; // Stays queued; retried on the next pass.
    }
    sql.withTransactionSync(() => {
      sql.runSync("DELETE FROM publish_removals WHERE client_id = ?", [entry.client_id]);
      sql.runSync("DELETE FROM id_map WHERE client_id = ?", [entry.client_id]);
    });
    removed += 1;
  }
  return removed;
}
