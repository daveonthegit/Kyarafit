/**
 * Queries whose result `useOfflineQuery` overlays with pending `entity_rows` writes so offline
 * create/edit/delete shows before sync (see `offlineEntityOverlay`). Only **plain-document**
 * queries are listed — a list of entity docs, or a single entity doc — since the overlay merges by
 * `_id`. Derived/projected queries (e.g. `workflow:listPlanner`, `builds:get` enriched joins) are
 * intentionally omitted; overlaying raw docs onto a computed shape would be incorrect.
 *
 * `idArg` (doc queries only) names the argument holding the viewed id, so an offline-created row
 * can be shown by its `clientId` even when the server has never seen it.
 */

export type EntityQueryOverlay =
  | { table: string; kind: "list" }
  | { table: string; kind: "doc"; idArg: string }
  | { table: string; kind: "planner" };

const QUERY_OVERLAYS: Record<string, EntityQueryOverlay> = {
  "builds:list": { table: "builds", kind: "list" },
  "conventions:list": { table: "conventions", kind: "list" },
  "conventions:get": { table: "conventions", kind: "doc", idArg: "id" },
  "workflow:listPlanner": { table: "workflowItems", kind: "planner" },
};

export function offlineEntityQuery(functionName: string): EntityQueryOverlay | null {
  return QUERY_OVERLAYS[functionName] ?? null;
}
