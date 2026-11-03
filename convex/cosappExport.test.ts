import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPORT_MAX_PHOTO_BYTES, PHOTO_BATCH_BYTES, MAX_PHOTOS_PER_CALL } from "@kyarafit/design-system/domain/cosappExport";
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
    expect(result.photoFiles).toEqual([expect.objectContaining({ storageId: url, size: image.length })]);
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
    const result = await t.withIdentity({ subject: "alice" }).action(api.cosappExport.prepare, {});
    expect(result.photoFiles).toEqual([]);
    expect(result.receipt.droppedImages).toEqual([{ image: url, reason }]);
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
