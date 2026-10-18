import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import { recordTestBlobType } from "./mediaTestHelpers.fixture";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import {
  MB,
  MAX_PENDING_UPLOADS,
  UPLOAD_TTL_MS,
  PENDING_TTL_MS,
  releaseUserStorage,
  UPLOAD_RECOVERY_TTL_MS,
  uploadContentType,
} from "./lib/storageOwnership";

const modules = import.meta.glob("./**/*.ts");
type Harness = ReturnType<typeof convexTest>;

async function seed(t: Harness, subject = "alice", usage = 0, tier = "PRO") {
  await t.run((ctx) =>
    ctx.db.insert("users", {
      externalId: subject,
      email: `${subject}@example.invalid`,
      tier,
      currentUsageMb: usage,
    })
  );
  return t.withIdentity({ subject });
}
async function uploadBytes(t: Harness, actor = "alice", bytes = 1024) {
  const url = await t
    .withIdentity({ subject: actor })
    .mutation(api.files.generateUploadUrlForSize, { sizeBytes: bytes });
  const response = await t.fetch(new URL(url).pathname + new URL(url).search, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: new Uint8Array(bytes),
  });
  expect(response.status).toBe(200);
  return (await response.json()).storageId as Id<"_storage">;
}
async function usage(t: Harness, subject = "alice") {
  return t.withIdentity({ subject }).query(api.users.getMe, {});
}
async function build(t: Harness, subject = "alice", visibility = "private") {
  return t
    .withIdentity({ subject })
    .mutation(api.builds.create, { name: "Build", status: "idea", visibility });
}

beforeEach(() => vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("owner-bound ingress and pending previews", () => {
  it("keeps the upload URL/POST response contract and allows only uploader discovery", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    await seed(t, "bob");
    const url = new URL(await alice.mutation(api.files.generateUploadUrl));
    const response = await t.fetch(url.pathname + url.search, {
      method: "POST",
      body: new Uint8Array(1024),
    });
    expect(response.status).toBe(200);
    const id = (await response.json()).storageId as Id<"_storage">;
    expect(
      await t.withIdentity({ subject: "alice" }).query(api.files.getUrl, { storageId: id })
    ).toBeTruthy();
    expect(
      await t.withIdentity({ subject: "bob" }).query(api.files.getUrl, { storageId: id })
    ).toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: id })).toBeNull();
    expect((await usage(t))?.currentUsageMb).toBeCloseTo(1024 / MB);
    const claims = await t.run((ctx) => ctx.db.query("storageClaims").collect());
    expect(claims).toMatchObject([
      { userId: "alice", storageId: id, sizeBytes: 1024, attached: false },
    ]);
  });

  it("does not accept caller claims over another blob, unknown blobs, or foreign profile attachments", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const id = await uploadBytes(t, "bob");
    await expect(alice.mutation(api.users.updateProfileImage, { storageId: id })).rejects.toThrow(
      /not authorized/
    );
    const unknown = await t.run((ctx) => ctx.storage.store(new Blob(["unknown"])));
    await expect(
      alice.mutation(api.builds.create, { name: "Forged", status: "idea", imageStorageId: unknown })
    ).rejects.toThrow(/not authorized/);
    expect(await bob.query(api.files.getUrl, { storageId: unknown })).toBeNull();
    await bob.mutation(api.users.updateProfileImage, { storageId: id });
    expect((await usage(t, "bob"))?.currentUsageMb).toBeCloseTo(1024 / MB);
    await expect(t.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/Unauthorized/);
    await expect(t.mutation(api.users.updateProfileImage, { storageId: id })).rejects.toThrow(
      /Unauthorized/
    );
  });

  it("consumes a token once, rejects missing tokens, and supports browser preflight without cookies", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const url = new URL(
      await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 100 })
    );
    const path = url.pathname + url.search;
    const options = await t.fetch("/media/upload", {
      method: "OPTIONS",
      headers: { Origin: "https://app.example.invalid" },
    });
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(options.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect((await t.fetch(path, { method: "POST", body: "photo" })).status).toBe(200);
    expect((await t.fetch(path, { method: "POST", body: "again" })).status).toBe(403);
    expect((await t.fetch("/media/upload", { method: "POST", body: "photo" })).status).toBe(403);
    expect(await t.run((ctx) => ctx.db.query("storageClaims").collect())).toHaveLength(1);
  });

  it("bounds pending minting and reserves quota across concurrent uploads", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t, "alice", 2047);
    const results = await Promise.allSettled(
      [1, 2].map(() => alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: MB }))
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const t2 = convexTest(schema, modules);
    const bob = await seed(t2, "bob");
    for (let i = 0; i < MAX_PENDING_UPLOADS; i++)
      await bob.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 1 });
    await expect(
      bob.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 1 })
    ).rejects.toThrow(/pending/);
  });

  it("counts uploaded orphans toward both bytes and the pending limit", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t, "alice", 2047);
    await uploadBytes(t, "alice", MB);
    await expect(
      alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 1 })
    ).rejects.toThrow(/storage limit/i);
    const t2 = convexTest(schema, modules);
    const bob = await seed(t2, "bob");
    for (let i = 0; i < MAX_PENDING_UPLOADS; i++) await uploadBytes(t2, "bob", 1);
    await expect(
      bob.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 1 })
    ).rejects.toThrow(/pending/);
    expect(await t2.run((ctx) => ctx.db.query("storageClaims").collect())).toHaveLength(
      MAX_PENDING_UPLOADS
    );
  });

  it.each(["declared", "streamed", "empty"])(
    "rejects %s invalid body and releases its reservation without storing bytes",
    async (kind) => {
      const t = convexTest(schema, modules);
      const alice = await seed(t);
      const url = new URL(
        await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 2 })
      );
      const response = await t.fetch(url.pathname + url.search, {
        method: "POST",
        headers: kind === "declared" ? { "Content-Length": "4" } : {},
        body: kind === "empty" ? "" : "four",
      });
      expect(response.status).toBe(kind === "empty" ? 400 : 413);
      expect(await t.run((ctx) => ctx.db.query("storageClaims").collect())).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("storageUploadReservations").collect())
      ).toHaveLength(0);
      expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(0);
      expect((await usage(t))?.currentUsageMb).toBe(0);
    }
  );

  it("checks quota again after a tier change and removes the rejected blob", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t, "alice", 100);
    const url = new URL(await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 4 }));
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").first();
      await ctx.db.patch(user!._id, { tier: "FREE" });
    });
    expect(
      (await t.fetch(url.pathname + url.search, { method: "POST", body: "four" })).status
    ).toBe(503);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(0);
    expect((await usage(t))?.currentUsageMb).toBe(100);
  });

  it("a deleted account cannot discover or reattach its pending upload with a stale session", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const id = await uploadBytes(t);
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").first();
      await ctx.db.delete(user!._id);
    });
    expect(await alice.query(api.files.getUrl, { storageId: id })).toBeNull();
    await expect(
      alice.mutation(api.builds.create, {
        name: "Deleted account",
        status: "idea",
        imageStorageId: id,
      })
    ).rejects.toThrow(/account not found/);
  });

  it("expired and deleted-account reservations cannot accept bytes", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const url = new URL(await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 4 }));
    vi.advanceTimersByTime(UPLOAD_TTL_MS + 1);
    expect(
      (await t.fetch(url.pathname + url.search, { method: "POST", body: "four" })).status
    ).toBe(403);
    await t.finishInProgressScheduledFunctions();
    const url2 = new URL(
      await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 4 })
    );
    await t.run(async (ctx) => {
      const user = await ctx.db.query("users").first();
      await ctx.db.delete(user!._id);
    });
    expect(
      (await t.fetch(url2.pathname + url2.search, { method: "POST", body: "four" })).status
    ).toBe(403);
  });

  it("recovers interrupted stores in bounded pages without releasing quota early or deleting shared blobs", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const alice = await seed(t, "alice", 2047);
    const url = new URL(
      await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: MB })
    );
    const reservation = await t.mutation(internal.files.consumeReservation, {
      token: url.searchParams.get("token")!,
    });
    const b = await build(t);
    const { orphan, shared } = await t.run(async (ctx) => {
      for (let i = 0; i < 55; i++) await ctx.storage.store(new Blob(["unrelated"]));
      const type = uploadContentType("image/png", reservation!.uploadTag);
      const shared = await ctx.storage.store(new Blob(["shared"], { type }));
      recordTestBlobType(shared, type);
      await ctx.db.patch(b!._id, { imageStorageId: shared });
      const orphan = await ctx.storage.store(new Blob(["orphan"], { type }));
      recordTestBlobType(orphan, type);
      return { orphan, shared };
    });
    vi.advanceTimersByTime(UPLOAD_TTL_MS + 1);
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.get(reservation!._id))).not.toBeNull();
    await expect(
      alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 1 })
    ).rejects.toThrow(/storage limit/i);
    vi.advanceTimersByTime(UPLOAD_RECOVERY_TTL_MS);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", orphan))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", shared))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(reservation!._id))).toBeNull();
    expect((await usage(t))?.currentUsageMb).toBe(2047);
  });

  it("bounds concurrent legacy no-argument mints without changing the installed SDK signature", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t, "alice", 2040);
    const url = new URL(await alice.mutation(api.files.generateUploadUrl));
    await expect(alice.mutation(api.files.generateUploadUrl)).rejects.toThrow(/storage limit/i);
    expect(
      (await t.fetch(url.pathname + url.search, { method: "POST", body: "photo" })).status
    ).toBe(200);
    await expect(alice.mutation(api.files.generateUploadUrl)).resolves.toEqual(expect.any(String));
  });

  it("cleans abandoned claims and refunds only their verified byte charge", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await seed(t, "alice", 10);
    const id = await uploadBytes(t);
    vi.advanceTimersByTime(PENDING_TTL_MS + 1);
    expect(
      await t.withIdentity({ subject: "alice" }).query(api.files.getUrl, { storageId: id })
    ).toBeNull();
    await t.finishInProgressScheduledFunctions();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("storageClaims").collect())).toHaveLength(0);
    expect((await usage(t))?.currentUsageMb).toBeCloseTo(10);
  });
});

describe("reference discovery/attachment matrix", () => {
  it("keeps a private progress image private even on a public build; explicit shares work", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const stranger = await seed(t, "stranger");
    const b = await build(t, "alice", "public");
    const id = await uploadBytes(t);
    const row = await alice.mutation(api.buildProgressUpdates.add, {
      buildId: b!._id,
      imageRefs: [{ kind: "cloud", storageId: id, imageKey: "photo" }],
    });
    expect(await t.query(api.files.getUrl, { storageId: id })).toBeNull();
    expect(await stranger.query(api.files.getUrl, { storageId: id })).toBeNull();
    expect(await alice.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    await expect(bob.mutation(api.users.updateProfileImage, { storageId: id })).rejects.toThrow(
      /not authorized/
    );
    await alice.mutation(api.buildCollaborators.set, {
      buildId: b!._id,
      userId: "bob",
      role: "editor",
    });
    expect(await bob.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    await bob.mutation(api.users.updateProfileImage, { storageId: id });
    await alice.mutation(api.buildProgressUpdates.update, { id: row!._id, publish: true });
    expect(await t.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    await alice.mutation(api.buildProgressUpdates.update, { id: row!._id, publish: false });
    expect(await t.query(api.files.getUrl, { storageId: id })).toBeNull();
  });

  it("public covers are anonymously discoverable but not available for a stranger to attach", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const id = await uploadBytes(t);
    const b = await alice.mutation(api.builds.create, {
      name: "Public",
      status: "idea",
      visibility: "public",
      imageStorageId: id,
    });
    expect(await t.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    await expect(
      bob.mutation(api.builds.create, { name: "Foreign", status: "idea", imageStorageId: id })
    ).rejects.toThrow(/not authorized/);
    const group = await alice.mutation(api.groups.create, { name: "Team" });
    await alice.mutation(api.groups.addMember, { groupId: group!._id, newUserId: "bob" });
    await alice.mutation(api.builds.setGroupId, { buildId: b!._id, groupId: group!._id });
    await alice.mutation(api.builds.update, { id: b!._id, visibility: "private" });
    expect(await bob.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    await bob.mutation(api.builds.create, { name: "Shared", status: "idea", imageStorageId: id });
  });

  it("attributes an editor-uploaded hero to the editor, not the build owner", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const b = await build(t);
    await alice.mutation(api.buildCollaborators.set, {
      buildId: b!._id,
      userId: "bob",
      role: "editor",
    });
    const id = await uploadBytes(t, "bob", MB);
    await bob.mutation(api.builds.update, { id: b!._id, imageStorageId: id });
    expect((await usage(t, "bob"))?.currentUsageMb).toBe(1);
    expect((await usage(t))?.currentUsageMb).toBe(0);
    expect(await alice.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    await alice.mutation(api.buildCollaborators.remove, { buildId: b!._id, userId: "bob" });
    expect(await bob.query(api.files.getUrl, { storageId: id })).toBeNull();
    await expect(
      bob.mutation(api.builds.create, { name: "Revoked", status: "idea", imageStorageId: id })
    ).rejects.toThrow(/not authorized/);
  });

  it.each(["gallery", "process", "convention", "element", "group"])(
    "rejects foreign pending attachments on the %s path",
    async (kind) => {
      const t = convexTest(schema, modules);
      const alice = await seed(t);
      await seed(t, "bob");
      const b = await build(t);
      const id = await uploadBytes(t, "bob");
      const result =
        kind === "gallery"
          ? alice.mutation(api.buildReferenceImages.add, { buildId: b!._id, imageStorageId: id })
          : kind === "process"
            ? alice.mutation(api.buildProcessPictures.add, { buildId: b!._id, imageStorageId: id })
            : kind === "convention"
              ? alice.mutation(api.conventions.create, {
                  name: "Event",
                  startDate: "2026-10-01",
                  endDate: "2026-10-02",
                  imageStorageId: id,
                })
              : kind === "element"
                ? alice.mutation(api.cosplayNodes.create, {
                    nodeType: "element",
                    tags: [],
                    name: "Element",
                    imageStorageId: id,
                  })
                : alice.mutation(api.groups.create, { name: "Team", imageStorageId: id });
      await expect(result).rejects.toThrow(/not authorized/);
      expect((await usage(t))?.currentUsageMb).toBe(0);
    }
  );

  it("does not refund a legacy image for unrelated field edits, or charge a duplicate reference again", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t, "alice", 1);
    const b = await build(t);
    const id = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob([new Uint8Array(MB)]));
      await ctx.db.patch(b!._id, { imageStorageId: storageId });
      return storageId;
    });
    await alice.mutation(api.builds.update, { id: b!._id, name: "Renamed" });
    expect((await usage(t))?.currentUsageMb).toBe(1);
    await alice.mutation(api.builds.create, {
      name: "Another reference",
      status: "idea",
      imageStorageId: id,
    });
    expect((await usage(t))?.currentUsageMb).toBe(1);
  });

  it("accounts once across profile, galleries, progress and duplicates, and retains any live reference", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const id = await uploadBytes(t, "alice", MB);
    const b = await alice.mutation(api.builds.create, {
      name: "Source",
      status: "idea",
      imageStorageId: id,
    });
    await alice.mutation(api.users.updateProfileImage, { storageId: id });
    const progress = await alice.mutation(api.buildProgressUpdates.add, {
      buildId: b!._id,
      imageRefs: [
        { kind: "cloud", storageId: id, imageKey: "one" },
        { kind: "cloud", storageId: id, imageKey: "two" },
      ],
    });
    const reference = await alice.mutation(api.buildReferenceImages.add, {
      buildId: b!._id,
      imageStorageId: id,
    });
    await alice.mutation(api.builds.duplicate, { sourceBuildId: b!._id });
    expect((await usage(t))?.currentUsageMb).toBe(1);
    expect(await alice.mutation(api.users.recalculateUsage, {})).toBe(1);
    await alice.mutation(api.buildReferenceImages.remove, { id: reference!._id });
    await alice.mutation(api.buildProgressUpdates.remove, { id: progress!._id });
    await t.mutation(internal.files.cleanupClaim, { storageId: id });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", id))).not.toBeNull();
    expect((await usage(t))?.currentUsageMb).toBe(1);
  });

  it("rejects foreign progress arrays on add/update and preserves the old row atomically", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    await seed(t, "bob");
    const b = await build(t);
    const foreign = await uploadBytes(t, "bob");
    const refs = [{ kind: "cloud" as const, storageId: foreign, imageKey: "foreign" }];
    await expect(
      alice.mutation(api.buildProgressUpdates.add, { buildId: b!._id, imageRefs: refs })
    ).rejects.toThrow(/not authorized/);
    const row = await alice.mutation(api.buildProgressUpdates.add, {
      buildId: b!._id,
      note: "Original",
    });
    await expect(
      alice.mutation(api.buildProgressUpdates.update, {
        id: row!._id,
        imageRefs: refs,
        note: "Forged",
      })
    ).rejects.toThrow(/not authorized/);
    expect(await t.run((ctx) => ctx.db.get(row!._id))).toMatchObject({
      note: "Original",
      imageRefs: [],
    });
  });

  it("handles legacy nested private progress references without granting strangers a fallback", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const b = await build(t, "alice", "public");
    const id = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["legacy"]));
      await ctx.db.insert("buildProgressUpdates", {
        userId: "alice",
        buildId: b!._id,
        createdAt: 1,
        imageRefs: [{ kind: "cloud", storageId, imageKey: "legacy" }],
        publishedToFeed: false,
        updatedAt: 1,
        version: 1,
      });
      return storageId;
    });
    expect(await t.query(api.files.getUrl, { storageId: id })).toBeNull();
    expect(await bob.query(api.files.getUrl, { storageId: id })).toBeNull();
    expect(await alice.query(api.files.getUrl, { storageId: id })).toBeTruthy();
  });

  it("drains the indexed legacy bridge in resumable batches without changing visibility", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const b = await build(t);
    const id = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["legacy"]));
      for (let i = 0; i < 40; i++)
        await ctx.db.insert("buildProgressUpdates", {
          userId: "alice",
          buildId: b!._id,
          createdAt: i,
          imageRefs: [{ kind: "cloud", storageId, imageKey: String(i) }],
          publishedToFeed: false,
          updatedAt: i,
          version: 1,
        });
      return storageId;
    });
    expect(await alice.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    expect(await t.mutation(internal.files.indexLegacyProgress, {})).toBe(25);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("buildProgressUpdates")
          .withIndex("by_mediaIndexed", (q) => q.eq("mediaIndexed", undefined))
          .collect()
      )
    ).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("progressMediaReferences").collect())).toHaveLength(
      40
    );
    expect(await alice.query(api.files.getUrl, { storageId: id })).toBeTruthy();
    expect(await bob.query(api.files.getUrl, { storageId: id })).toBeNull();
  });

  it("updates the reverse index and cleans the last detached/tombstoned progress blob", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const b = await build(t);
    const id = await uploadBytes(t);
    const row = await alice.mutation(api.buildProgressUpdates.add, {
      buildId: b!._id,
      imageRefs: [{ kind: "cloud", storageId: id, imageKey: "x" }],
    });
    expect(await t.run((ctx) => ctx.db.query("progressMediaReferences").collect())).toHaveLength(1);
    await alice.mutation(api.buildProgressUpdates.update, { id: row!._id, imageRefs: [] });
    expect(await t.run((ctx) => ctx.db.query("progressMediaReferences").collect())).toHaveLength(0);
    await t.mutation(internal.files.cleanupClaim, { storageId: id });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", id))).toBeNull();
    expect((await usage(t))?.currentUsageMb).toBe(0);
  });

  it("retains pending charges when usage is recalculated", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    await uploadBytes(t, "alice", MB);
    expect(await alice.mutation(api.users.recalculateUsage, {})).toBe(1);
  });
});

describe("S5 account-removal seam", () => {
  it("cancels unused reservations, refunds unreferenced claims, and preserves shared bytes", async () => {
    const t = convexTest(schema, modules);
    const alice = await seed(t);
    const bob = await seed(t, "bob");
    const sharedId = await uploadBytes(t);
    const pendingId = await uploadBytes(t);
    const b = await alice.mutation(api.builds.create, {
      name: "Shared",
      status: "idea",
      imageStorageId: sharedId,
    });
    await alice.mutation(api.buildCollaborators.set, {
      buildId: b!._id,
      userId: "bob",
      role: "editor",
    });
    await bob.mutation(api.builds.create, {
      name: "Retained",
      status: "idea",
      imageStorageId: sharedId,
    });
    await alice.mutation(api.files.generateUploadUrlForSize, { sizeBytes: 1 });
    await t.run(async (ctx) => {
      await ctx.db.delete(b!._id);
      await releaseUserStorage(ctx, "alice");
      const user = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", "alice"))
        .unique();
      await ctx.db.delete(user!._id);
    });
    expect(await t.run((ctx) => ctx.db.query("storageUploadReservations").collect())).toHaveLength(
      0
    );
    expect(await t.run((ctx) => ctx.db.system.get("_storage", pendingId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", sharedId))).not.toBeNull();
    expect(await bob.query(api.files.getUrl, { storageId: sharedId })).toBeTruthy();
    expect(await alice.query(api.files.getUrl, { storageId: sharedId })).toBeNull();
    await expect(alice.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(
      /account not found/
    );
  });
});
