/**
 * Queries whose result `useOfflineQuery` overlays with pending `entity_rows` writes so offline
 * create/edit/delete shows before sync (see `offlineEntityOverlay`). Only plain-document queries are
 * listed — a list of entity docs, or a single entity doc — since the overlay merges by `_id`.
 *
 * Web Wave 3 scope: the migrated Builds-list slice (`builds:list`). Other web screens keep using
 * `convex/react` directly and are not overlaid. Keys are Convex function names.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
export type EntityQueryOverlay =
  | { table: string; kind: "list" }
  | { table: string; kind: "doc"; idArg: string };

const QUERY_OVERLAYS: Record<string, EntityQueryOverlay> = {
  "builds:list": { table: "builds", kind: "list" },
};

export function offlineEntityQuery(functionName: string): EntityQueryOverlay | null {
  return QUERY_OVERLAYS[functionName] ?? null;
}
