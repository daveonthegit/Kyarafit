import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function harness() {
  return convexTest(schema, modules);
}

afterEach(() => vi.unstubAllEnvs());

describe("development seed boundary", () => {
  it.each(["production", "test", ""])("rejects seeding outside development (%s)", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    vi.stubEnv("ENABLE_DEV_SEED", "true");
    const t = harness();
    await expect(
      t.withIdentity({ subject: "seed-owner" }).mutation(api.seed.createStarter, {})
    ).rejects.toThrow("Development seeding is disabled");
    expect(await t.run((ctx) => ctx.db.query("builds").collect())).toEqual([]);
  });

  it("requires explicit opt-in even in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_SEED", undefined);
    const t = harness();
    await expect(
      t.withIdentity({ subject: "seed-owner" }).mutation(api.seed.createStarter, {})
    ).rejects.toThrow("Development seeding is disabled");
  });

  it("requires a session when development seeding is enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_SEED", "true");
    await expect(harness().mutation(api.seed.createStarter, {})).rejects.toThrow("Unauthorized");
  });

  it("creates only the session owner's sample data and deduplicates retries", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_DEV_SEED", "true");
    const t = harness();
    const owner = t.withIdentity({ subject: "seed-owner" });
    expect((await owner.mutation(api.seed.createStarter, {})).skipped).toBe(false);
    expect((await owner.mutation(api.seed.createStarter, {})).skipped).toBe(true);
    await t.run(async (ctx) => {
      for (const table of ["builds", "conventions", "cosplayNodes", "buildTasks"] as const) {
        const rows = await ctx.db.query(table).collect();
        expect(rows).toHaveLength(1);
        expect(rows[0].userId).toBe("seed-owner");
      }
    });
  });
});
