/**
 * Storage layer: get / set / list.
 * Default adapter: SQLite (placeholder init; no sync yet).
 */

import type { StorageAdapter } from "./types";
import { sqliteStorage } from "./sqlite";

let adapter: StorageAdapter = sqliteStorage;

export function setStorageAdapter(a: StorageAdapter): void {
  adapter = a;
}

export async function get(key: string): Promise<string | null> {
  return adapter.get(key);
}

export async function set(key: string, value: string): Promise<void> {
  return adapter.set(key, value);
}

export async function remove(key: string): Promise<void> {
  return adapter.remove(key);
}

export async function list(
  prefix?: string
): Promise<{ key: string; value: string; updatedAt?: number }[]> {
  return adapter.list(prefix);
}

export type { StorageAdapter, StorageItem } from "./types";
