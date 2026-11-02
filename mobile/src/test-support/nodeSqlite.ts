import { DatabaseSync } from "node:sqlite";
import type { VaultBindValue, VaultSql } from "@/vault/store";

/** Accept both expo-sqlite call styles: `(sql, [a, b])` and `(sql, a, b)`. */
function flatten(rest: (VaultBindValue | VaultBindValue[])[]): unknown[] {
  const values = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
  return values.map((value) => (typeof value === "boolean" ? Number(value) : value));
}

/**
 * Test adapter: a real SQLite database (Node's built-in `node:sqlite`) exposing the synchronous
 * subset of expo-sqlite's `SQLiteDatabase` that the vault uses. Lets vault tests exercise actual SQL,
 * constraints and transactions instead of a mock that "acknowledges" every write.
 */
export class NodeSqliteDatabase implements VaultSql {
  readonly db: DatabaseSync;
  /** When set, the next matching `runSync` throws (simulates disk-full / I/O errors). */
  failNextWrite: ((source: string) => boolean) | null = null;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
  }

  execSync(source: string): void {
    this.db.exec(source);
  }

  runSync(source: string, ...rest: (VaultBindValue | VaultBindValue[])[]): { changes: number } {
    const params = flatten(rest);
    if (this.failNextWrite?.(source)) {
      this.failNextWrite = null;
      throw new Error("database or disk is full");
    }
    const result = this.db.prepare(source).run(...params);
    return { changes: Number(result.changes) };
  }

  getAllSync<T>(source: string, ...rest: (VaultBindValue | VaultBindValue[])[]): T[] {
    const params = flatten(rest);
    return this.db.prepare(source).all(...params) as T[];
  }

  getFirstSync<T>(source: string, ...rest: (VaultBindValue | VaultBindValue[])[]): T | null {
    const params = flatten(rest);
    return (this.db.prepare(source).get(...params) as T | undefined) ?? null;
  }

  withTransactionSync(task: () => void): void {
    this.db.exec("BEGIN");
    try {
      task();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  closeSync(): void {
    this.db.close();
  }
}
