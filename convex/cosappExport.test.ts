import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPORT_MAX_PHOTO_BYTES, PHOTO_BATCH_BYTES, MAX_PHOTOS_PER_CALL, MAX_EXTERNAL_PHOTOS_PER_CALL, withoutPhotoFiles } from "@kyarafit/design-system/domain/cosappExport";
import { api, internal } from "./_generated/api";
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
  it("omits deleted content from snapshots and photo authorization", async () => {
    const { t, ids } = await harness();
    const timestamp = Date.now() + 60_000;
    await t.run(async (ctx) => {
      const node = await ctx.db.query("cosplayNodes").withIndex("by_userId", (q) => q.eq("userId", "alice")).first();
      const task = await ctx.db.query("workflowItems").withIndex("by_userId", (q) => q.eq("userId", "alice")).first();
      const attachment = await ctx.db.query("workflowAttachments").withIndex("by_userId", (q) => q.eq("userId", "alice")).first();
      await ctx.db.patch(node!._id, { name: "deleted secret node", deletedAt: timestamp });
      await ctx.db.patch(task!._id, { title: "deleted secret task", updatedAt: timestamp + 1, deletedAt: timestamp });
      await ctx.db.patch(attachment!._id, { deletedAt: timestamp + 2 });
      const conventionId = await ctx.db.insert("conventions", { userId: "alice", name: "Live convention", startDate: "2027-01-01", endDate: "2027-01-01" });
      await ctx.db.insert("packingListItems", { userId: "alice", conventionId, label: "deleted secret packing", checked: false, deletedAt: timestamp + 3 });
      await ctx.db.insert("builds", { userId: "alice", name: "deleted secret build", notes: "deleted secret notes", imageStorageId: ids.bob.image, status: "idea", deletedAt: timestamp + 4 });
      await ctx.db.patch(ids.bob.build, { updatedAt: timestamp + 1_000_000 });
    });
    const alice = t.withIdentity({ subject: "alice" });
    const rows = await alice.query(internal.cosappExport.snapshot, {});
    expect(rows.cosplayNodes).toEqual([]);
    expect(rows.workflowItems).toEqual([]);
    expect(rows.workflowAttachments).toEqual([]);
    expect(rows.packingListItems).toEqual([]);
    expect(JSON.stringify(rows)).not.toContain("deleted secret");
    expect(JSON.stringify(rows)).not.toContain(ids.bob.image);
    const exported = await alice.action(api.cosappExport.prepare, {});
    expect(exported.data.rows.builds[0].updatedAt).toBe(Math.floor(rows.builds[0]._creationTime));
    expect(JSON.stringify(exported)).not.toContain("deleted secret");
    await expect(alice.action(api.cosappExport.photoBytes, { storageIds: [ids.bob.image] })).rejects.toThrow(/Photo not found/);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns null for an authorized photo whose blob vanished", async () => {
    const { t, ids } = await harness();
    const alice = t.withIdentity({ subject: "alice" });
    expect((await alice.action(api.cosappExport.prepare, {})).photoFiles).toHaveLength(1);
    await t.run((ctx) => ctx.storage.delete(ids.alice.image));
    expect(await alice.action(api.cosappExport.photoBytes, { storageIds: [ids.alice.image] })).toEqual([
      expect.objectContaining({ storageId: ids.alice.image, bytes: null, failure: "missingImage" }),
    ]);
  });

  it("transfers the largest supported stored photo in bounded responses", async () => {
    const { t, ids } = await harness();
    const image = new Uint8Array(EXPORT_MAX_PHOTO_BYTES);
    image.set([0xff, 0xd8, 0xff]);
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob([image], { type: "image/jpeg" }));
      await ctx.db.patch(ids.alice.build, { imageStorageId: id });
      return id;
    });
    const alice = t.withIdentity({ subject: "alice" });
    expect((await alice.action(api.cosappExport.prepare, {})).photoFiles[0].size).toBe(image.length);
    let received = 0;
    for (let offset = 0; offset < image.length; offset += PHOTO_BATCH_BYTES) {
      const [chunk] = await alice.action(api.cosappExport.photoBytes, { storageIds: [storageId], offset });
      expect(chunk.bytes!.byteLength).toBeLessThanOrEqual(PHOTO_BATCH_BYTES);
      expect(new Uint8Array(chunk.bytes!)).toEqual(image.slice(offset, offset + PHOTO_BATCH_BYTES));
      received += chunk.bytes!.byteLength;
    }
    expect(received).toBe(image.length);
    await expect(alice.action(api.cosappExport.photoBytes, { storageIds: Array(MAX_PHOTOS_PER_CALL + 1).fill(storageId) })).rejects.toThrow(/Too many photos/);
  });

  it("downloads owned external images on the server without trusting requested URLs", async () => {
    const { t, ids } = await harness();
    const image = new Uint8Array([0xff, 0xd8, 0xff, 1]);
    const fetcher = vi.fn(async () => new Response(image));
    vi.stubGlobal("fetch", fetcher);
    const url = "https://example.com/alice.jpg";
    await t.run((ctx) => ctx.db.patch(ids.alice.build, { imageStorageId: undefined, imageUrl: url }));
    const alice = t.withIdentity({ subject: "alice" });
    const result = await alice.action(api.cosappExport.prepare, {});
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.photoFiles).toEqual([expect.objectContaining({ storageId: url, size: EXPORT_MAX_PHOTO_BYTES })]);
    expect(result.data.rows.builds[0].notes).not.toContain(url);
    const [served] = await alice.action(api.cosappExport.photoBytes, { storageIds: [url] });
    expect(new Uint8Array(served.bytes!)).toEqual(image);
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const calls = fetcher.mock.calls.length;
    await expect(alice.action(api.cosappExport.photoBytes, { storageIds: ["https://example.com/bob.jpg"] })).rejects.toThrow(/Photo not found/);
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it.each([
    ["missingImage", () => new Response(null, { status: 404 })],
    ["unsupportedImage", () => new Response("not an image")],
    ["oversizeImage", () => new Response(new Uint8Array(EXPORT_MAX_PHOTO_BYTES + 1))],
  ] as const)("lists external image failures as %s", async (reason, response) => {
    const { t, ids } = await harness();
    vi.stubGlobal("fetch", vi.fn(async () => response()));
    const url = "https://example.com/alice.jpg";
    await t.run((ctx) => ctx.db.patch(ids.alice.build, { imageStorageId: undefined, imageUrl: url }));
    const alice = t.withIdentity({ subject: "alice" });
    const result = await alice.action(api.cosappExport.prepare, {});
    const [served] = await alice.action(api.cosappExport.photoBytes, { storageIds: [url] });
    expect(served.bytes).toBeNull();
    expect(served.failure).toBe(reason);
    expect(withoutPhotoFiles(result, new Set(result.photoFiles.map((file) => file.fileName)), served.failure).receipt.droppedImages).toEqual([{ image: url, reason }]);
  });
  it("defers account-wide fetching and bounds parallel external work per call", async () => {
    const { t } = await harness();
    const urls = Array.from({ length: 61 }, (_, i) => `https://example.com/${i}.jpg`);
    await t.run(async (ctx) => {
      for (const imageUrl of urls) await ctx.db.insert("builds", { userId: "carol", name: imageUrl, status: "idea", imageUrl });
    });
    let active = 0;
    let peak = 0;
    const fetcher = vi.fn(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return new Response(new Uint8Array([0xff, 0xd8, 0xff]));
    });
    vi.stubGlobal("fetch", fetcher);
    const carol = t.withIdentity({ subject: "carol" });
    const prepared = await carol.action(api.cosappExport.prepare, {});
    expect(prepared.photoFiles).toHaveLength(61);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(carol.action(api.cosappExport.photoBytes, { storageIds: urls.slice(0, MAX_EXTERNAL_PHOTOS_PER_CALL + 1) })).rejects.toThrow(/Too many external photos/);
    expect(fetcher).not.toHaveBeenCalled();
    const served = await carol.action(api.cosappExport.photoBytes, { storageIds: urls.slice(0, MAX_EXTERNAL_PHOTOS_PER_CALL) });
    expect(served.every((file) => file.bytes?.byteLength === 3)).toBe(true);
    expect(peak).toBe(MAX_EXTERNAL_PHOTOS_PER_CALL);
    expect(active).toBe(0);
  });

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
