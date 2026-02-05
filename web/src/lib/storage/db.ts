/**
 * IndexedDB setup for web local-first storage
 * Schema matches mobile SQLite for sync compatibility
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'kyarafit';
const DB_VERSION = 1;

export interface ClosetItem {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  notes: string | null;
  tags: string[];
  costCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Build {
  id: string;
  name: string;
  character: string | null;
  status: 'idea' | 'wip' | 'ready';
  notes: string | null;
  imageUrl: string | null;
  budgetCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuildTask {
  id: string;
  buildId: string;
  label: string;
  closetItemId: string | null;
  sortOrder: number;
  checked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Convention {
  id: string;
  name: string;
  location: string | null;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConventionDayPlan {
  id: string;
  conventionId: string;
  date: string;
  buildId: string | null;
  notes: string | null;
}

export interface PackingListItem {
  id: string;
  conventionId: string;
  date: string | null;
  buildId: string | null;
  closetItemId: string | null;
  label: string;
  checked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxEntry {
  id: number;
  type: string;
  payload: any;
  createdAt: string;
}

export interface KVEntry {
  key: string;
  value: string;
}

export interface KyarafitDB {
  closet_items: {
    key: string;
    value: ClosetItem;
    indexes: { updatedAt: string };
  };
  builds: {
    key: string;
    value: Build;
    indexes: { updatedAt: string };
  };
  build_tasks: {
    key: string;
    value: BuildTask;
    indexes: { buildId: string; updatedAt: string };
  };
  conventions: {
    key: string;
    value: Convention;
    indexes: { updatedAt: string };
  };
  convention_day_plans: {
    key: string;
    value: ConventionDayPlan;
    indexes: { conventionId: string };
  };
  packing_list_items: {
    key: string;
    value: PackingListItem;
    indexes: { conventionId: string; updatedAt: string };
  };
  outbox: {
    key: number;
    value: OutboxEntry;
    autoIncrement: true;
  };
  kv: {
    key: string;
    value: KVEntry;
  };
}

let dbInstance: IDBPDatabase<KyarafitDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<KyarafitDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<KyarafitDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Closet items
      if (!db.objectStoreNames.contains('closet_items')) {
        const closetStore = db.createObjectStore('closet_items', { keyPath: 'id' });
        closetStore.createIndex('updatedAt', 'updatedAt');
      }

      // Builds
      if (!db.objectStoreNames.contains('builds')) {
        const buildsStore = db.createObjectStore('builds', { keyPath: 'id' });
        buildsStore.createIndex('updatedAt', 'updatedAt');
      }

      // Build tasks
      if (!db.objectStoreNames.contains('build_tasks')) {
        const tasksStore = db.createObjectStore('build_tasks', { keyPath: 'id' });
        tasksStore.createIndex('buildId', 'buildId');
        tasksStore.createIndex('updatedAt', 'updatedAt');
      }

      // Conventions
      if (!db.objectStoreNames.contains('conventions')) {
        const conventionsStore = db.createObjectStore('conventions', { keyPath: 'id' });
        conventionsStore.createIndex('updatedAt', 'updatedAt');
      }

      // Convention day plans
      if (!db.objectStoreNames.contains('convention_day_plans')) {
        const plansStore = db.createObjectStore('convention_day_plans', { keyPath: 'id' });
        plansStore.createIndex('conventionId', 'conventionId');
      }

      // Packing list items
      if (!db.objectStoreNames.contains('packing_list_items')) {
        const packingStore = db.createObjectStore('packing_list_items', { keyPath: 'id' });
        packingStore.createIndex('conventionId', 'conventionId');
        packingStore.createIndex('updatedAt', 'updatedAt');
      }

      // Outbox for sync
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }

      // Key-value store
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// KV helpers
export async function getValue(key: string): Promise<string | null> {
  const db = await getDB();
  const entry = await db.get('kv', key);
  return entry?.value ?? null;
}

export async function setValue(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put('kv', { key, value });
}

// Helper to get current timestamp
export function now(): string {
  return new Date().toISOString();
}
