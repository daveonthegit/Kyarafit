/**
 * Maps an offline-queued mutation to the optimistic `entity_rows` overlay write(s) it implies, so
 * the UI reflects the change before it syncs (see `entityRows`, `offlineEntityOverlay`). Pure and
 * shared by the bridge (which writes overlays when a mutation is enqueued offline) and the sync
 * worker (which clears the same overlays once the mutation replays).
 *
 * Scope: the create/edit/delete surfaces in the Phase 1 DoD — **builds**, **conventions**, and
 * **workflow items** (tasks; overlaid into the projected planner + build-tree views via
 * `offlinePlannerOverlay` / `offlineBuildTreeOverlay`). Mutations not listed return no writes, so
 * they are simply not shown optimistically.
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

    case "workflow:create":
      if (!clientId) return [];
      return [
        { table: "workflowItems", id: clientId, doc: { ...args, _id: clientId }, deleted: false },
      ];
    case "workflow:update": {
      const id = typeof args.id === "string" ? args.id : null;
      return id ? [{ table: "workflowItems", id, doc: editFields(args, id), deleted: false }] : [];
    }
    case "workflow:remove": {
      const id = typeof args.id === "string" ? args.id : null;
      return id ? [{ table: "workflowItems", id, doc: null, deleted: true }] : [];
    }
    case "workflow:move": {
      const id = typeof args.id === "string" ? args.id : null;
      return id
        ? [
            {
              table: "workflowItems",
              id,
              doc: { _id: id, parentId: args.parentId ?? undefined, sortOrder: args.sortOrder },
              deleted: false,
            },
          ]
        : [];
    }
    case "workflow:moveAndResequence": {
      const move = asRecord(args.move);
      const writes: EntityOverlayWrite[] = [];
      if (typeof move.id === "string") {
        writes.push({
          table: "workflowItems",
          id: move.id,
          doc: { _id: move.id, parentId: move.parentId ?? undefined, sortOrder: move.sortOrder },
          deleted: false,
        });
      }
      const resequence = Array.isArray(args.resequence) ? args.resequence : [];
      for (const entry of resequence) {
        const row = asRecord(entry);
        if (typeof row.id === "string") {
          writes.push({
            table: "workflowItems",
            id: row.id,
            doc: { _id: row.id, sortOrder: row.sortOrder },
            deleted: false,
          });
        }
      }
      return writes;
    }

    default:
      return [];
  }
}
