import { replicaBuildIdsFor } from "@kyarafit/design-system/domain/replicaProtocol";
import type { VaultSql } from "../store";

export function conflictBuildIds(
  sql: VaultSql, table: string, rowId: string, lost: Record<string, unknown>
): Set<string> {
  const rows = sql.getAllSync<{ table_name: string; id: string; json: string }>(
    "SELECT table_name, id, json FROM entity_rows WHERE deleted = 0"
  );
  const docs: { table: string; rowId: string; doc: Record<string, unknown> }[] = [];
  for (const row of rows) {
    try {
      const doc: unknown = JSON.parse(row.json);
      if (doc && typeof doc === "object" && !Array.isArray(doc))
        docs.push({ table: row.table_name, rowId: row.id, doc: doc as Record<string, unknown> });
    } catch {
      continue;
    }
  }
  return replicaBuildIdsFor(table, rowId, lost, docs);
}
