import type { VaultPersistHook, VaultSql } from "./store";

export function queuePublicationRemoval(sql: VaultSql, table: string, id: string): void {
  if (table !== "builds" && table !== "conventions") return;
  sql.runSync(
    `INSERT INTO publish_removals (client_id, table_name, server_id) VALUES (?, ?, ?)
     ON CONFLICT(client_id) DO UPDATE SET table_name = excluded.table_name`,
    [id, table, id]
  );
}

export const recordPublicationRemovals: VaultPersistHook = (sql, changes) => {
  for (const change of changes) {
    if (!change.after) queuePublicationRemoval(sql, change.table, change.id);
  }
};
