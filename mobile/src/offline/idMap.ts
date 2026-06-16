import { getOfflineDb } from "./db";

/**
 * SQLite-backed `client_id -> server_id` map (blueprint §3.13.3), over the `id_map` table in
 * `./db`. Populated by the sync worker when an offline-created entity finally syncs and the server
 * returns its real document id. All helpers are best-effort and never throw, degrading to no-ops /
 * empty results so callers never crash (e.g. web / RN-web where `expo-sqlite` may be unavailable).
 */

/** Record (or refresh) the mapping from a locally-minted client id to its synced server id. */
export function setServerId(clientId: string, serverId: string): void {
  try {
    getOfflineDb().runSync(
      `INSERT INTO id_map (client_id, server_id, synced_at) VALUES (?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET server_id = excluded.server_id, synced_at = excluded.synced_at`,
      [clientId, serverId, Date.now()]
    );
  } catch {
    // Best-effort; ignore.
  }
}

/** Resolve a client id to its synced server id, or null if it has not synced yet. */
export function getServerId(clientId: string): string | null {
  try {
    const row = getOfflineDb().getFirstSync<{ server_id: string }>(
      `SELECT server_id FROM id_map WHERE client_id = ?`,
      [clientId]
    );
    return row?.server_id ?? null;
  } catch {
    return null;
  }
}

/** Load the full `client_id -> server_id` map for in-memory rewriting during a drain pass. */
export function loadIdMap(): Record<string, string> {
  try {
    const rows = getOfflineDb().getAllSync<{ client_id: string; server_id: string }>(
      `SELECT client_id, server_id FROM id_map`
    );
    const map: Record<string, string> = {};
    for (const row of rows) map[row.client_id] = row.server_id;
    return map;
  } catch {
    return {};
  }
}
