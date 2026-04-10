import { initClosetDb } from "./db.native";

const ACCOUNT_CACHE_TABLES = [
  "outbox",
  "workflow_dependencies",
  "workflow_attachments",
  "workflow_items",
  "build_item_links",
  "build_tasks",
  "packing_list_items",
  "convention_day_plans",
  "conventions",
  "builds",
  "closet_items",
  "kv",
] as const;

export async function clearSignedInAccountData(): Promise<void> {
  const db = await initClosetDb();
  await db.execAsync("PRAGMA foreign_keys = OFF;");
  try {
    for (const table of ACCOUNT_CACHE_TABLES) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON;");
  }
}
