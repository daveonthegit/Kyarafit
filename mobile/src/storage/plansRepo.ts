/**
 * Local convention day plans repository. Offline-first; anonymous users only.
 */

import type { ConventionDayPlan, DayPlanEntry } from "@kyarafit/design-system/types";
import { initClosetDb } from "./db";
import { enqueue } from "./outboxRepo";

export async function getPlan(conventionId: string): Promise<ConventionDayPlan[]> {
  const database = await initClosetDb();
  const rows = await database.getAllAsync<{
    id: string;
    convention_id: string;
    date: string;
    build_id: string | null;
    notes: string | null;
  }>(
    `SELECT id, convention_id, date, build_id, notes FROM convention_day_plans WHERE convention_id = ? ORDER BY date ASC`,
    [conventionId]
  );
  return rows.map((r) => ({
    id: r.id,
    conventionId: r.convention_id,
    date: r.date,
    buildId: r.build_id ?? null,
    notes: r.notes ?? undefined,
  }));
}

export async function setPlan(
  conventionId: string,
  plan: DayPlanEntry[]
): Promise<ConventionDayPlan[]> {
  const database = await initClosetDb();
  await database.runAsync(`DELETE FROM convention_day_plans WHERE convention_id = ?`, [
    conventionId,
  ]);
  const result: ConventionDayPlan[] = [];
  for (const e of plan) {
    const id = crypto.randomUUID();
    await database.runAsync(
      `INSERT INTO convention_day_plans (id, convention_id, date, build_id, notes) VALUES (?, ?, ?, ?, ?)`,
      [id, conventionId, e.date, e.buildId ?? null, e.notes ?? null]
    );
    result.push({
      id,
      conventionId,
      date: e.date,
      buildId: e.buildId ?? null,
      notes: e.notes,
    });
  }
  await enqueue("convention.plan.replace", {
    conventionLocalId: conventionId,
    plan: plan.map((e) => ({ date: e.date, buildLocalId: e.buildId ?? null, notes: e.notes })),
  });
  return result;
}
