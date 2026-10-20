import { migrateVaultSchema } from "@/offline/vaultSchema";
import { VaultStore, type VaultPersistHook } from "@/vault/store";
import { LOCAL_MUTATIONS, LOCAL_QUERIES } from "@/vault/handlers";
import { NodeSqliteDatabase } from "./nodeSqlite";

export const TEST_SUBJECT = "user_test";

/**
 * A real, schema-migrated vault over an in-memory SQLite database, plus helpers that invoke the
 * registered local handlers exactly as `runLocalQuery` / `runLocalMutation` do (minus the active
 * vault singleton). Ids are deterministic (`local:1`, `local:2`, …) and the clock is controllable.
 */
export function makeTestVault(
  options: { subject?: string; sql?: NodeSqliteDatabase; onPersist?: VaultPersistHook } = {}
) {
  const subject = options.subject ?? TEST_SUBJECT;
  const sql = options.sql ?? new NodeSqliteDatabase();
  migrateVaultSchema(sql, subject);
  let seq = 0;
  let clock = 1_700_000_000_000;
  const store = new VaultStore({
    subject,
    sql,
    newId: () => `local:${++seq}`,
    now: () => clock,
    onPersist: options.onPersist,
  });

  function query<T = unknown>(fn: string, args: Record<string, unknown> = {}): T {
    const handler = LOCAL_QUERIES[fn];
    if (!handler) throw new Error(`No local query ${fn}`);
    return handler({ db: store.reader(), userId: subject, now: clock }, args) as T;
  }

  function mutate<T = unknown>(fn: string, args: Record<string, unknown> = {}): T {
    const handler = LOCAL_MUTATIONS[fn];
    if (!handler) throw new Error(`No local mutation ${fn}`);
    return store.commit((db) => handler({ db, userId: subject, now: clock }, args)) as T;
  }

  return {
    subject,
    sql,
    store,
    query,
    mutate,
    /** Advance the fake clock (ms). */
    tick(ms = 1000) {
      clock += ms;
      return clock;
    },
    now: () => clock,
  };
}
