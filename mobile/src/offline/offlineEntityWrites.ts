/**
 * Maps an offline-queued mutation to the optimistic `entity_rows` overlay write(s) it implies, so
 * the UI reflects the change before it syncs (see `entityRows`, `offlineEntityOverlay`). Pure and
 * shared by the bridge (which writes overlays when a mutation is enqueued offline) and the sync
 * worker (which clears the same overlays once the mutation replays).
 *
 * Scope: the plain-document create/edit/delete surfaces in the Phase 1 DoD — **builds** and
 * **conventions**. Derived/projected queries (planner, build tree) are not overlaid here. Mutations
 * not listed return no writes, so they are simply not shown optimistically.
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
    case "conventions:create":
      if (!clientId) return [];
      return [
        { table: "conventions", id: clientId, doc: { ...args, _id: clientId }, deleted: false },
      ];

    case "builds:update": {
      const id = typeof args.id === "string" ? args.id : null;
      return id ? [{ table: "builds", id, doc: editFields(args, id), deleted: false }] : [];
    }
    case "conventions:update": {
      const id = typeof args.id === "string" ? args.id : null;
      return id ? [{ table: "conventions", id, doc: editFields(args, id), deleted: false }] : [];
    }

    case "builds:updateStatusMany":
      return idStrings(args.ids).map((id) => ({
        table: "builds",
        id,
        doc: { _id: id, status: args.status },
        deleted: false,
      }));
    case "conventions:archiveMany":
      return idStrings(args.ids).map((id) => ({
        table: "conventions",
        id,
        doc: { _id: id, archived: args.archived },
        deleted: false,
      }));

    case "builds:removeMany":
      return idStrings(args.ids).map((id) => ({ table: "builds", id, doc: null, deleted: true }));
    case "conventions:removeMany":
      return idStrings(args.ids).map((id) => ({
        table: "conventions",
        id,
        doc: null,
        deleted: true,
      }));

    default:
      return [];
  }
}
