/**
 * Local storage abstraction for offline-first.
 * Implementations: SQLite (default), in-memory stub.
 */

export interface StorageItem {
  key: string;
  value: string;
  updatedAt?: number;
}

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix?: string): Promise<StorageItem[]>;
}
