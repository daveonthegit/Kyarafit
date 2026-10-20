import { replicaBuildIdOf } from "@kyarafit/design-system/domain/replicaProtocol";
import type { VaultSql } from "../store";

export function conflictBuildIds(
  sql: VaultSql, table: string, rowId: string, lost: Record<string, unknown>
): Set<string> {
  const rows = sql.getAllSync<{ table_name: string; id: string; json: string }>(
    "SELECT table_name, id, json FROM entity_rows WHERE deleted = 0"
  );
  const docs = new Map<string, { table: string; doc: Record<string, unknown> }>();
  for (const row of rows) {
    try {
      const doc: unknown = JSON.parse(row.json);
      if (doc && typeof doc === "object" && !Array.isArray(doc))
        docs.set(row.id, { table: row.table_name, doc: doc as Record<string, unknown> });
    } catch {
      continue;
    }
  }
  const builds = new Set<string>();
  const seen = new Set<string>();
  const visit = (kind: string, id: string, doc: Record<string, unknown>) => {
    if (seen.has(id)) return;
    seen.add(id);
    const direct = replicaBuildIdOf(kind, { ...doc, _id: id });
    if (direct) builds.add(direct);
    for (const field of ["parentNodeId", "parentId", "cosplayNodeId", "workflowItemId", "packingListItemId"]) {
      const target = doc[field];
      const parent = typeof target === "string" ? docs.get(target) : undefined;
      if (parent) visit(parent.table, target as string, parent.doc);
    }
    if (kind === "workflowItems") {
      for (const [attachmentId, attachment] of docs) {
        if (attachment.table === "workflowAttachments" && attachment.doc.workflowItemId === id)
          visit(attachment.table, attachmentId, attachment.doc);
      }
    }
    if (kind === "workflowAttachments" && typeof doc.entityId === "string") {
      const entity = docs.get(doc.entityId);
      if (entity) visit(entity.table, doc.entityId, entity.doc);
    }
  };
  const current = docs.get(rowId)?.doc ?? {};
  visit(table, rowId, current);
  seen.clear();
  visit(table, rowId, { ...current, ...lost });
  return builds;
}
