/**
 * Maps an offline-queued mutation to the optimistic `entity_rows` overlay write(s) it implies, so
 * the UI reflects the change before it syncs (see `runtime`, `offlineEntityOverlay`). Pure and
 * shared by the bridge (writes overlays when a mutation is enqueued offline) and the sync worker
 * (clears the same overlays once the mutation replays).
 *
 * Web Wave 3 scope: the migrated Builds-list slice — create / update / bulk status / bulk remove.
 * Mutations not listed return no writes, so they are simply not shown optimistically.
 *
 * OFFLINE CORE: never imports `convex/react`.
 */
export type EntityOverlayWrite = {
  table: string;
  id: string;
  doc: Record<string, unknown> | null;
  deleted: boolean;
};

function asRecord(args: unknown): Record<string, unknown> {
  return args !== null && typeof args === "object" ? (args as Record<string, unknown>) : {};
}

/** Fields to merge for an edit: drop control args that are not part of the document. */
function editFields(args: Record<string, unknown>, id: string): Record<string, unknown> {
  const { idempotencyKey: _k, id: _id, ...rest } = args;
  return { ...rest, _id: id };
}

function idStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function overlayWritesFor(
  fn: string,
  rawArgs: unknown,
  clientId: string | undefined
): EntityOverlayWrite[] {
  const args = asRecord(rawArgs);
  switch (fn) {
    case "builds:create":
      if (!clientId) return [];
      return [{ table: "builds", id: clientId, doc: { ...args, _id: clientId }, deleted: false }];

    case "builds:update": {
      const id = typeof args.id === "string" ? args.id : null;
      return id ? [{ table: "builds", id, doc: editFields(args, id), deleted: false }] : [];
    }

    case "builds:updateStatusMany":
      return idStrings(args.ids).map((id) => ({
        table: "builds",
        id,
        doc: { _id: id, status: args.status },
        deleted: false,
      }));

    case "builds:removeMany":
      return idStrings(args.ids).map((id) => ({ table: "builds", id, doc: null, deleted: true }));

    default:
      return [];
  }
}
