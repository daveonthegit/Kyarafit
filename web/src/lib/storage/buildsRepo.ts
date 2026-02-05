/**
 * Builds repository for web IndexedDB
 */

import { getDB, type Build, now } from "./db";
import { enqueueOutbox } from "./outboxRepo";
import { v4 as uuidv4 } from "uuid";

export async function list(): Promise<Build[]> {
  const db = await getDB();
  return db.getAll("builds");
}

export async function getById(id: string): Promise<Build | null> {
  const db = await getDB();
  const build = await db.get("builds", id);
  return build || null;
}

export async function create(
  data: {
    name: string;
    status?: "idea" | "wip" | "ready";
    character?: string;
    notes?: string;
    imageUrl?: string;
    budgetCents?: number;
  },
  shouldSync: boolean = true
): Promise<Build> {
  const db = await getDB();
  const id = uuidv4();
  const timestamp = now();

  const build: Build = {
    id,
    name: data.name,
    status: data.status || "idea",
    character: data.character || null,
    notes: data.notes || null,
    imageUrl: data.imageUrl || null,
    budgetCents: data.budgetCents || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.put("builds", build);

  // Enqueue for sync if user has PREMIUM_BASIC+
  if (shouldSync) {
    await enqueueOutbox("build.upsert", { build });
  }

  return build;
}

export async function update(
  id: string,
  data: Partial<Omit<Build, "id" | "createdAt" | "updatedAt">>,
  shouldSync: boolean = true
): Promise<Build | null> {
  const db = await getDB();
  const existing = await db.get("builds", id);
  if (!existing) return null;

  const updated: Build = {
    ...existing,
    ...data,
    updatedAt: now(),
  };

  await db.put("builds", updated);

  // Enqueue for sync
  if (shouldSync) {
    await enqueueOutbox("build.upsert", { build: updated });
  }

  return updated;
}

export async function deleteBuild(id: string, shouldSync: boolean = true): Promise<void> {
  const db = await getDB();
  await db.delete("builds", id);

  // Also delete associated tasks
  const tasks = await db.getAllFromIndex("build_tasks", "buildId", id);
  for (const task of tasks) {
    await db.delete("build_tasks", task.id);
  }

  if (shouldSync) {
    await enqueueOutbox("build.delete", { id });
  }
}

// Sync helper: upsert from server without triggering outbox
export async function upsertFromSync(build: Build): Promise<void> {
  const db = await getDB();
  await db.put("builds", build);
}
