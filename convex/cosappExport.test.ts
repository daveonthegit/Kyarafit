import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

// "Download for Cosapp.si": the export reads only the signed-in account's own rows and serves only
// the photo files those rows reference. Converter rules are covered by web/src/lib/cosappExport.test.ts.

const modules = import.meta.glob("./**/*.ts");

async function seed(ctx: MutationCtx, userId: string, label: string) {
  const image = await ctx.storage.store(new Blob([`${label}-image`], { type: "image/jpeg" }));
  const build = await ctx.db.insert("builds", {
    userId,
    name: `${label} build`,
    status: "wip",
    notes: `${label} secret notes`,
    imageStorageId: image,
  });
  await ctx.db.insert("builds", {
    userId,
    name: `${label} deleted build`,
    status: "idea",
    notes: `${label} deleted notes`,
    deletedAt: 5,
  });
  const node = await ctx.db.insert("cosplayNodes", {
    userId,
    buildId: build,
    name: `${label} cape`,
    nodeType: "element",
    tags: [],
  });
  const task = await ctx.db.insert("workflowItems", {
    userId,
    title: `${label} sew cape`,
    kind: "task",
    category: "craft",
    status: "not_started",
    ancestorIds: [],
    sortOrder: 0,
    scopeKind: "build_specific",
    sourceKind: "manual",
  });
  await ctx.db.insert("workflowAttachments", {
    userId,
    workflowItemId: task,
    entityType: "cosplayNode",
    entityId: node,
    entityKey: `cosplayNode:${node}`,
    role: "progress_source",
    buildContextId: build,
  });
  return { image, build };
}

async function harness() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    alice: await seed(ctx, "alice", "Alice"),
    bob: await seed(ctx, "bob", "Bob"),
  }));
  return { t, ids };
}

describe("cosappExport", () => {
  it("rejects callers without a session", async () => {
    const { t, ids } = await harness();
    await expect(t.action(api.cosappExport.prepare, {})).rejects.toThrow(/Unauthorized/);
    await expect(
      t.action(api.cosappExport.photoBytes, { storageIds: [ids.bob.image] })
    ).rejects.toThrow(/Unauthorized/);
  });

  it("exports only the caller's own live rows", async () => {
    const { t, ids } = await harness();
    const result = await t.withIdentity({ subject: "alice" }).action(api.cosappExport.prepare, {});
    const text = JSON.stringify(result);
    expect(text).toContain("Alice secret notes");
    expect(text).not.toContain("Bob");
    expect(text).not.toContain(ids.bob.build);
    expect(text).not.toContain("Alice deleted");
    expect(result.data.rows.builds.map((b) => b.character)).toEqual(["Alice build"]);
    expect(result.data.rows.tasks.map((task) => [task.title, task.pieceId])).toEqual([
      ["Alice sew cape", expect.stringMatching(/^ky-p-/)],
    ]);
    expect(result.photoFiles).toEqual([
      expect.objectContaining({ storageId: ids.alice.image, size: "Alice-image".length }),
    ]);
  });

  it("serves the caller's photo bytes and refuses anyone else's", async () => {
    const { t, ids } = await harness();
    const alice = t.withIdentity({ subject: "alice" });
    const [served] = await alice.action(api.cosappExport.photoBytes, {
      storageIds: [ids.alice.image],
    });
    expect(new TextDecoder().decode(served.bytes!)).toBe("Alice-image");
    await expect(
      alice.action(api.cosappExport.photoBytes, { storageIds: [ids.bob.image] })
    ).rejects.toThrow(/Photo not found/);
    await expect(
      alice.action(api.cosappExport.photoBytes, { storageIds: [ids.alice.image, ids.bob.image] })
    ).rejects.toThrow(/Photo not found/);
  });

  it("does not serve a deleted build's image", async () => {
    const { t, ids } = await harness();
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.alice.build as Id<"builds">, { deletedAt: 10 });
    });
    const alice = t.withIdentity({ subject: "alice" });
    expect((await alice.action(api.cosappExport.prepare, {})).photoFiles).toEqual([]);
    await expect(
      alice.action(api.cosappExport.photoBytes, { storageIds: [ids.alice.image] })
    ).rejects.toThrow(/Photo not found/);
  });

  it("gives an account with no data an empty backup", async () => {
    const { t } = await harness();
    const result = await t.withIdentity({ subject: "carol" }).action(api.cosappExport.prepare, {});
    expect(result.data.rows.builds).toEqual([]);
    expect(result.receipt.counts.builds).toBe(0);
  });
});
