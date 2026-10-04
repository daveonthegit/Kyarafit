import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { Id, TableNames } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as deletion from "./lib/accountDeletion";
import { createAuthOptions } from "./betterAuth/auth";
import { recordTestBlobType } from "./mediaTestHelpers.fixture";
import { UPLOAD_RECOVERY_TTL_MS, uploadContentType } from "./lib/storageOwnership";

const modules = import.meta.glob("./**/*.ts");
type Harness = ReturnType<typeof convexTest>;
const begin = makeFunctionReference<"mutation", { externalId: string }, Id<"accountDeletionJobs">>(
  "accountDeletion:begin"
);
const resume = makeFunctionReference<"mutation", { jobId: Id<"accountDeletionJobs"> }>(
  "accountDeletion:resume"
);
const step = makeFunctionReference<
  "mutation",
  { jobId: Id<"accountDeletionJobs">; revision: number }
>("accountDeletion:step");
const status = makeFunctionReference<
  "query",
  { jobId: Id<"accountDeletionJobs"> },
  {
    status: string;
    phase: number;
    processed: number;
    attempts: number;
    scheduledState?: string;
  }
>("accountDeletion:status");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function user(t: Harness, externalId = "alice") {
  return t.run((ctx) =>
    ctx.db.insert("users", {
      externalId,
      email: `${externalId}@example.invalid`,
      tier: "PRO",
      currentUsageMb: 0,
    })
  );
}
async function finish(t: Harness) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}
async function rows(t: Harness, table: TableNames) {
  return t.run((ctx) => ctx.db.query(table).collect());
}
async function advanceTo(t: Harness, jobId: Id<"accountDeletionJobs">, phase: number) {
  for (let i = 0; i < 2000; i++) {
    const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
    if (job.phase === phase) return;
    await t.mutation(step, { jobId, revision: job.revision });
  }
  throw new Error("Fixture did not reach its checkpoint");
}

async function populate(t: Harness) {
  const alice = await user(t);
  const bob = await user(t, "bob");
  const fixture = await t.run(async (ctx) => {
    const blob = await ctx.storage.store(new Blob(["private photo"]));
    await ctx.db.patch(alice, { imageStorageId: blob });
    const build = await ctx.db.insert("builds", { userId: "alice", name: "Owned", status: "idea" });
    const otherBuild = await ctx.db.insert("builds", {
      userId: "bob",
      name: "Retained",
      status: "idea",
    });
    const group = await ctx.db.insert("groups", {
      name: "Owned",
      createdBy: "alice",
      visibility: "private",
      createdAt: 1,
    });
    await ctx.db.patch(otherBuild, { groupId: group });
    const node = await ctx.db.insert("cosplayNodes", {
      userId: "alice",
      name: "Element",
      nodeType: "item",
      tags: [],
      buildId: build,
    });
    const closet = await ctx.db.insert("closetItems", {
      userId: "alice",
      name: "Legacy",
      category: "other",
      tags: [],
      imageStorageId: blob,
    });
    const convention = await ctx.db.insert("conventions", {
      userId: "alice",
      name: "Event",
      startDate: "2026-01-01",
      endDate: "2026-01-01",
    });
    const template = await ctx.db.insert("workflowTemplates", {
      userId: "alice",
      slug: "private",
      name: "Owned",
      isBuiltIn: false,
    });
    const builtIn = await ctx.db.insert("workflowTemplates", {
      slug: "builtin",
      name: "Builtin",
      isBuiltIn: true,
    });
    const taskFields = {
      title: "Task",
      kind: "task",
      category: "general",
      status: "todo",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "personal",
      sourceKind: "manual",
    };
    const task = await ctx.db.insert("workflowItems", { ...taskFields, userId: "alice" });
    const otherTask = await ctx.db.insert("workflowItems", {
      ...taskFields,
      userId: "bob",
      creatorUserId: "alice",
      assigneeUserId: "alice",
      ownerUserId: "alice",
      parentId: task,
      ancestorIds: [task],
      templateId: template,
    });
    const otherNode = await ctx.db.insert("cosplayNodes", {
      userId: "bob",
      name: "Retained element",
      nodeType: "item",
      tags: [],
      parentNodeId: node,
      buildId: build,
    });
    await ctx.db.insert("workflowTemplateItems", {
      templateId: template,
      templateItemKey: "owned",
      sortOrder: 0,
      title: "Private",
      kind: "task",
      category: "general",
      status: "todo",
    });
    await ctx.db.insert("workflowDependencies", {
      userId: "bob",
      predecessorWorkflowItemId: task,
      successorWorkflowItemId: otherTask,
      relationKind: "blocks",
    });
    await ctx.db.insert("workflowAttachments", {
      userId: "alice",
      workflowItemId: task,
      entityType: "build",
      entityId: build,
      entityKey: `build:${build}`,
      role: "primary",
    });
    await ctx.db.insert("workflowAttachments", {
      userId: "bob",
      workflowItemId: otherTask,
      entityType: "build",
      entityId: build,
      entityKey: `build:${build}`,
      role: "primary",
    });
    await ctx.db.insert("buildTasks", {
      userId: "alice",
      buildId: build,
      cosplayNodeId: node,
      label: "Task",
      sortOrder: 0,
      checked: false,
    });
    await ctx.db.insert("packingListItems", {
      userId: "alice",
      conventionId: convention,
      cosplayNodeId: node,
      workflowItemId: task,
      label: "Pack",
      checked: false,
    });
    await ctx.db.insert("conventionDayPlans", {
      userId: "alice",
      conventionId: convention,
      date: "2026-01-01",
      buildId: build,
    });
    await ctx.db.insert("groupConventionDays", {
      groupId: group,
      conventionId: convention,
      date: "2026-01-01",
    });
    await ctx.db.insert("groupMembers", { userId: "bob", groupId: group, role: "member" });
    await ctx.db.insert("follows", { followerId: "alice", followingId: "bob" });
    await ctx.db.insert("follows", { followerId: "bob", followingId: "alice" });
    await ctx.db.insert("buildLikes", { userId: "bob", buildId: build });
    await ctx.db.insert("buildComments", {
      userId: "alice",
      buildId: otherBuild,
      body: "Private copy",
      createdAt: 1,
    });
    await ctx.db.insert("buildCollaborators", { userId: "bob", buildId: build, role: "editor" });
    await ctx.db.insert("activities", {
      userId: "alice",
      kind: "update",
      buildId: build,
      createdAt: 1,
    });
    for (const table of ["buildReferenceImages", "buildProcessPictures"] as const)
      await ctx.db.insert(table, {
        userId: "alice",
        buildId: build,
        imageStorageId: blob,
        sortOrder: 0,
      });
    const progress = await ctx.db.insert("buildProgressUpdates", {
      userId: "alice",
      buildId: build,
      createdAt: 1,
      note: "Private",
      imageRefs: [{ kind: "cloud", storageId: blob, imageKey: "photo" }],
      publishedToFeed: false,
      mediaIndexed: true,
    });
    await ctx.db.insert("progressMediaReferences", { storageId: blob, progressUpdateId: progress });
    await ctx.db.insert("cosplayNodeLinks", {
      userId: "alice",
      parentNodeId: node,
      childNodeId: otherNode,
      sortOrder: 0,
      linkMode: "reference",
    });
    await ctx.db.insert("buildCosplayLinks", {
      userId: "alice",
      buildId: build,
      cosplayNodeId: node,
      sortOrder: 0,
    });
    await ctx.db.insert("buildNodeStates", {
      userId: "alice",
      buildId: build,
      cosplayNodeId: node,
    });
    await ctx.db.insert("buildItemLinks", {
      userId: "alice",
      buildId: build,
      closetItemId: closet,
    });
    await ctx.db.insert("idempotencyLedger", {
      userId: "alice",
      key: "retry",
      operation: "builds:create",
      createdAt: 1,
      result: { note: "Private result" },
    });
    await ctx.db.insert("idempotencyLedger", {
      userId: "bob",
      key: "assigned-task",
      operation: "workflow.create",
      createdAt: 1,
      result: { userId: "bob", assigneeUserId: "alice" },
    });
    const foreignProgress = await ctx.db.insert("buildProgressUpdates", {
      userId: "bob",
      buildId: build,
      createdAt: 1,
      publishedToFeed: false,
      mediaIndexed: true,
      imageRefs: [{ kind: "cloud", storageId: blob, imageKey: "foreign" }],
    });
    await ctx.db.insert("progressMediaReferences", {
      storageId: blob,
      progressUpdateId: foreignProgress,
    });
    await ctx.db.insert("userPushPreferences", {
      userId: alice,
      expoPushToken: "synthetic-device-token",
      marketingOptIn: true,
      transactionalOptIn: true,
      updatedAt: 1,
    });
    await ctx.db.insert("broadcasts", {
      createdBy: alice,
      createdAt: 1,
      title: "Owned",
      body: "Private",
      audience: "all",
      scheduledAt: Date.now() + 1000,
    });
    const broadcast = await ctx.db.insert("broadcasts", {
      createdBy: bob,
      createdAt: 1,
      title: "Retained",
      body: "Campaign",
      audience: "userIds",
      audienceArgs: { userIds: ["alice", "bob", alice] },
      scheduledAt: Date.now() + 1000,
    });
    await ctx.db.insert("storageClaims", {
      userId: "alice",
      storageId: blob,
      sizeBytes: 13,
      expiresAt: Date.now() + 10000,
      attached: true,
    });
    await ctx.db.insert("storageUploadReservations", {
      userId: "alice",
      token: "synthetic-reservation",
      uploadTag: "unused",
      reservedBytes: 1,
      expiresAt: Date.now() + 10000,
      consumed: false,
    });
    return { blob, group, otherBuild, otherTask, otherNode, builtIn, broadcast };
  });
  return { ...fixture, alice, bob };
}

describe("complete, bounded account deletion", () => {
  it("cleans every owned table, legacy rows, relationship copies, consent, results and media", async () => {
    const t = convexTest(schema, modules);
    const fixture = await populate(t);
    const jobId = await t.mutation(begin, { externalId: "alice" });
    expect(await t.run((ctx) => ctx.db.get(fixture.alice))).toBeNull();
    expect(await rows(t, "userPushPreferences")).toHaveLength(0);
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
    const retainedTables: Partial<Record<TableNames, number>> = {
      broadcasts: 1,
      builds: 1,
      cosplayNodes: 1,
      workflowItems: 1,
      workflowTemplates: 1,
    };
    for (const table of new Set(deletion.DELETION_TABLES))
      expect(await rows(t, table), table).toHaveLength(retainedTables[table] ?? 0);
    expect(await rows(t, "storageClaims")).toHaveLength(0);
    expect(await rows(t, "storageUploadReservations")).toHaveLength(0);
    expect(await rows(t, "accountDeletionAssets")).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", fixture.blob))).toBeNull();
    const build = await t.run((ctx) => ctx.db.get(fixture.otherBuild));
    expect(build?.groupId).toBeUndefined();
    const task = await t.run((ctx) => ctx.db.get(fixture.otherTask));
    expect(task).toMatchObject({ userId: "bob", ancestorIds: [] });
    for (const field of [
      "creatorUserId",
      "assigneeUserId",
      "ownerUserId",
      "parentId",
      "templateId",
    ])
      expect(task?.[field as keyof typeof task]).toBeUndefined();
    const node = await t.run((ctx) => ctx.db.get(fixture.otherNode));
    expect(node?.buildId).toBeUndefined();
    expect(node?.parentNodeId).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.get(fixture.broadcast)))?.audienceArgs).toEqual({
      userIds: ["bob"],
    });
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job?.externalId).toBeUndefined();
    expect(job?.userId).toBeUndefined();
    expect(job?.cursor).toBeUndefined();
    expect(job?.scheduledId).toBeUndefined();
    expect(await t.mutation(internal.broadcasts.deliverDueStub, {})).toEqual({
      ok: true,
      processed: 0,
    });
  });

  it("prevents stale sessions from writing, replaying or recreating the account before and after cleanup", async () => {
    const t = convexTest(schema, modules);
    await populate(t);
    const alice = t.withIdentity({ subject: "alice" });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    for (const after of [false, true]) {
      if (after) await finish(t);
      await expect(
        alice.mutation(api.users.upsert, { email: "alice@example.invalid" })
      ).rejects.toThrow("Unauthorized");
      await expect(
        alice.mutation(api.builds.create, {
          name: "Replay",
          status: "idea",
          idempotencyKey: "retry",
        })
      ).rejects.toThrow("Unauthorized");
      await expect(
        alice.mutation(api.push.registerToken, { token: "synthetic-token" })
      ).rejects.toThrow("User not found");
      expect(await alice.query(api.users.getByExternalId, {})).toBeNull();
      expect(await t.mutation(begin, { externalId: "alice" })).toBe(jobId);
    }
    expect(await rows(t, "users")).toHaveLength(1);
  });

  it("cleans orphaned mirrors even if the app user was already removed", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("idempotencyLedger", {
        userId: "orphan",
        key: "old",
        createdAt: 1,
        result: { note: "retained copy" },
      })
    );
    await t.mutation(begin, { externalId: "orphan" });
    await finish(t);
    expect(await rows(t, "idempotencyLedger")).toHaveLength(0);
  });

  it("preserves shared progress bytes, transfers accounting once, and deletes unclaimed legacy media", async () => {
    const t = convexTest(schema, modules);
    await user(t);
    const bob = await user(t, "bob");
    const { shared, legacy } = await t.run(async (ctx) => {
      const shared = await ctx.storage.store(new Blob(["shared"]));
      const legacy = await ctx.storage.store(new Blob(["legacy"]));
      const a = await ctx.db.insert("builds", { userId: "alice", name: "A", status: "idea" });
      const b = await ctx.db.insert("builds", { userId: "bob", name: "B", status: "idea" });
      await ctx.db.insert("buildProgressUpdates", {
        userId: "alice",
        buildId: a,
        createdAt: 1,
        publishedToFeed: false,
        imageRefs: [
          { kind: "cloud", storageId: shared, imageKey: "shared" },
          { kind: "cloud", storageId: legacy, imageKey: "legacy" },
        ],
      });
      const progress = await ctx.db.insert("buildProgressUpdates", {
        userId: "bob",
        buildId: b,
        createdAt: 1,
        publishedToFeed: false,
        mediaIndexed: true,
        imageRefs: [{ kind: "cloud", storageId: shared, imageKey: "shared" }],
      });
      await ctx.db.insert("progressMediaReferences", {
        storageId: shared,
        progressUpdateId: progress,
      });
      await ctx.db.insert("storageClaims", {
        storageId: shared,
        userId: "alice",
        sizeBytes: 6,
        attached: true,
        expiresAt: Date.now(),
      });
      return { shared, legacy };
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await finish(t);
    await t.mutation(resume, { jobId });
    await finish(t);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", legacy))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", shared))).not.toBeNull();
    expect(await rows(t, "storageClaims")).toMatchObject([{ userId: "bob", storageId: shared }]);
    expect((await t.run((ctx) => ctx.db.get(bob)))?.currentUsageMb).toBe(6 / (1024 * 1024));
  });

  it("checkpoints large accounts and ignores duplicate scheduled chunk deliveries", async () => {
    const t = convexTest(schema, modules);
    await user(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 137; i++)
        await ctx.db.insert("idempotencyLedger", {
          userId: "alice",
          key: `retry-${i}`,
          createdAt: 1,
        });
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    const revision = (await t.run((ctx) => ctx.db.get(jobId)))!.revision;
    await t.mutation(step, { jobId, revision });
    const checkpoint = await t.run((ctx) => ctx.db.get(jobId));
    await t.mutation(step, { jobId, revision });
    expect(await t.run((ctx) => ctx.db.get(jobId))).toEqual(checkpoint);
    await finish(t);
    expect(await rows(t, "idempotencyLedger")).toHaveLength(0);
    expect((await t.query(status, { jobId }))?.processed).toBeGreaterThanOrEqual(137);
  });

  it("records generic failure without retaining error text, then resumes from the unchanged checkpoint", async () => {
    const t = convexTest(schema, modules);
    await user(t);
    const jobId = await t.mutation(begin, { externalId: "alice" });
    const before = await t.run((ctx) => ctx.db.get(jobId));
    vi.spyOn(deletion, "stepDeletion").mockRejectedValueOnce(
      new Error("synthetic private failure detail")
    );
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("failed");
    const failed = await t.run((ctx) => ctx.db.get(jobId));
    expect(failed?.phase).toBe(before?.phase);
    expect(failed?.revision).toBe(before?.revision);
    expect(JSON.stringify(failed)).not.toContain("synthetic private failure detail");
    await t.mutation(resume, { jobId });
    await finish(t);
    expect(await t.query(status, { jobId })).toMatchObject({ status: "complete", attempts: 1 });
  });

  it("rolls back an interrupted media chunk and resumes without deleting shared copies", async () => {
    const t = convexTest(schema, modules);
    const fixture = await populate(t);
    const jobId = await t.mutation(begin, { externalId: "alice" });
    // Move through real checkpoints to the media phase, but do not deliver their scheduled actions.
    for (let i = 0; i < 200; i++) {
      const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
      if (job.phase === deletion.DELETION_TABLES.length) break;
      await t.run((ctx) => deletion.stepDeletion(ctx, jobId));
    }
    const before = await t.run((ctx) => ctx.db.get(jobId));
    await expect(
      t.run((ctx) =>
        deletion.stepDeletion(
          {
            ...ctx,
            storage: {
              ...ctx.storage,
              delete: async () => {
                throw new Error("transient provider failure");
              },
            },
          },
          jobId
        )
      )
    ).rejects.toThrow("transient provider failure");
    expect(await t.run((ctx) => ctx.db.get(jobId))).toEqual(before);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", fixture.blob))).not.toBeNull();
    await t.mutation(resume, { jobId });
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
  });

  it("waits for interrupted uploads and removes their tagged orphan bytes before completion", async () => {
    const t = convexTest(schema, modules);
    await user(t);
    const orphan = await t.run(async (ctx) => {
      const blob = await ctx.storage.store(new Blob(["interrupted upload"]));
      recordTestBlobType(blob, uploadContentType("image/png", "interrupted"));
      await ctx.db.insert("storageUploadReservations", {
        userId: "alice",
        token: "synthetic-token",
        uploadTag: "interrupted",
        reservedBytes: 100,
        expiresAt: Date.now() + 10000,
        consumed: true,
        consumedAt: Date.now(),
      });
      return blob;
    });
    const startedAt = Date.now();
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await finish(t);
    expect(
      (await t.run((ctx) => ctx.db.get(jobId)))!.completedAt! - startedAt
    ).toBeGreaterThanOrEqual(UPLOAD_RECOVERY_TTL_MS);
    expect(await t.run((ctx) => ctx.db.system.get("_storage", orphan))).toBeNull();
    expect(await rows(t, "storageUploadReservations")).toHaveLength(0);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
  });

  it("drains many pending claims and reservations without losing unreferenced bytes", async () => {
    const t = convexTest(schema, modules);
    await user(t);
    const blobs = await t.run(async (ctx) => {
      const ids = [];
      for (let i = 0; i < 41; i++) {
        const storageId = await ctx.storage.store(new Blob([`pending-${i}`]));
        ids.push(storageId);
        await ctx.db.insert("storageClaims", {
          storageId,
          userId: "alice",
          sizeBytes: 10,
          attached: false,
          expiresAt: Date.now() + 10000,
        });
        await ctx.db.insert("storageUploadReservations", {
          userId: "alice",
          token: `synthetic-${i}`,
          uploadTag: `unused-${i}`,
          reservedBytes: 10,
          expiresAt: Date.now() + 10000,
          consumed: false,
        });
      }
      return ids;
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
    expect(await rows(t, "storageClaims")).toHaveLength(0);
    expect(await rows(t, "storageUploadReservations")).toHaveLength(0);
    for (const storageId of blobs)
      expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
  });

  it("resumes long reference walks and retains a shared blob referenced after many tombstones", async () => {
    const t = convexTest(schema, modules);
    const alice = await user(t);
    const bob = await user(t, "bob");
    const shared = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["shared"]));
      await ctx.db.patch(alice, { imageStorageId: storageId });
      await ctx.db.insert("storageClaims", {
        storageId,
        userId: "alice",
        sizeBytes: 6,
        attached: true,
        expiresAt: Date.now(),
      });
      for (let i = 0; i < 31; i++)
        await ctx.db.insert("builds", {
          userId: "bob",
          name: "Deleted copy",
          status: "idea",
          imageStorageId: storageId,
          deletedAt: 1,
        });
      await ctx.db.insert("builds", {
        userId: "bob",
        name: "Retained copy",
        status: "idea",
        imageStorageId: storageId,
      });
      return storageId;
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", shared))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get(bob)))?.currentUsageMb).toBe(6 / (1024 * 1024));
    expect(await rows(t, "storageClaims")).toMatchObject([{ userId: "bob", storageId: shared }]);
  });

  it("rejects late writes to deleting resources and account targets before and after completion", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    await user(t);
    await user(t, "bob");
    const fixture = await t.run(async (ctx) => {
      const deletingBuild = await ctx.db.insert("builds", {
        userId: "alice",
        name: "Public",
        status: "idea",
        visibility: "public",
      });
      const retainedBuild = await ctx.db.insert("builds", {
        userId: "bob",
        name: "Retained",
        status: "idea",
      });
      const groupId = await ctx.db.insert("groups", {
        createdBy: "bob",
        name: "Retained",
        visibility: "private",
        createdAt: 1,
      });
      await ctx.db.insert("groupMembers", { groupId, userId: "bob", role: "admin" });
      return { deletingBuild, retainedBuild, groupId };
    });
    const bob = t.withIdentity({ subject: "bob" });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await advanceTo(t, jobId, deletion.DELETION_TABLES.indexOf("buildComments") + 1);
    await expect(
      bob.mutation(api.buildComments.add, { buildId: fixture.deletingBuild, body: "Late comment" })
    ).rejects.toThrow();
    for (const complete of [false, true]) {
      if (complete) await finish(t);
      await expect(bob.mutation(api.follows.follow, { followingId: "alice" })).rejects.toThrow(
        "Account unavailable"
      );
      await expect(
        bob.mutation(api.groups.addMember, { groupId: fixture.groupId, newUserId: "alice" })
      ).rejects.toThrow("Account unavailable");
      await expect(
        bob.mutation(api.buildCollaborators.set, {
          buildId: fixture.retainedBuild,
          userId: "alice",
          role: "viewer",
        })
      ).rejects.toThrow("Account unavailable");
      await expect(
        bob.mutation(api.workflow.create, { title: "Assigned", assigneeUserId: "alice" })
      ).rejects.toThrow("Account unavailable");
    }
    expect(await rows(t, "buildComments")).toHaveLength(0);
    expect(await rows(t, "follows")).toHaveLength(0);
    expect(await rows(t, "buildCollaborators")).toHaveLength(0);
    expect(await rows(t, "workflowItems")).toHaveLength(0);
  });

  it("removes foreign ledger snapshots and blocks re-recording references until their cleanup phase", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const fixture = await populate(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("idempotencyLedger", {
        userId: "bob",
        key: "deleted-parent",
        createdAt: 1,
        result: { userId: "bob", groupId: fixture.group },
      });
      await ctx.db.insert("idempotencyLedger", {
        userId: "bob",
        key: "retained-result",
        createdAt: 1,
        result: { userId: "bob", buildId: fixture.otherBuild },
      });
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await advanceTo(t, jobId, deletion.DELETION_TABLES.indexOf("idempotencyLedger") + 1);
    const bob = t.withIdentity({ subject: "bob" });
    await expect(
      bob.mutation(api.workflow.update, {
        id: fixture.otherTask,
        title: "Late update",
        idempotencyKey: "new-snapshot",
      })
    ).rejects.toThrow("Account unavailable");
    await expect(
      bob.mutation(api.builds.update, {
        id: fixture.otherBuild,
        notes: "Late update",
        idempotencyKey: "new-build-snapshot",
      })
    ).rejects.toThrow("Account unavailable");
    await finish(t);
    expect(await rows(t, "idempotencyLedger")).toHaveLength(1);
    expect(await rows(t, "idempotencyLedger")).toMatchObject([{ key: "retained-result" }]);
  });

  it("invalidates a shared-media cursor when references move behind its scanned range", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const alice = await user(t);
    const bobId = await user(t, "bob");
    const fixture = await t.run(async (ctx) => {
      const blob = await ctx.storage.store(new Blob(["shared"]));
      await ctx.db.patch(alice, { imageStorageId: blob });
      await ctx.db.insert("storageClaims", {
        userId: "alice",
        storageId: blob,
        sizeBytes: 6,
        attached: true,
        expiresAt: Date.now(),
      });
      const earlierBuild = await ctx.db.insert("builds", {
        userId: "bob",
        name: "Earlier",
        status: "idea",
      });
      for (let i = 0; i < 31; i++)
        await ctx.db.insert("builds", {
          userId: "bob",
          name: "Tombstone",
          status: "idea",
          imageStorageId: blob,
          deletedAt: 1,
        });
      const node = await ctx.db.insert("cosplayNodes", {
        userId: "bob",
        name: "Source",
        nodeType: "item",
        tags: [],
        imageStorageId: blob,
      });
      return { blob, earlierBuild, node };
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await advanceTo(t, jobId, deletion.DELETION_TABLES.length);
    for (let i = 0; i < 2; i++) await t.run((ctx) => deletion.stepDeletion(ctx, jobId));
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.cursor).toBeTruthy();
    const bob = t.withIdentity({ subject: "bob" });
    await bob.mutation(api.builds.update, {
      id: fixture.earlierBuild,
      imageStorageId: fixture.blob,
    });
    await bob.mutation(api.cosplayNodes.remove, { id: fixture.node });
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", fixture.blob))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get(bobId)))?.currentUsageMb).toBe(6 / (1024 * 1024));
  });

  it("invalidates the legacy-progress scan when an update moves photos into its reverse index", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    const alice = await user(t);
    await user(t, "bob");
    const fixture = await t.run(async (ctx) => {
      const blob = await ctx.storage.store(new Blob(["shared"]));
      await ctx.db.patch(alice, { imageStorageId: blob });
      await ctx.db.insert("storageClaims", {
        userId: "alice",
        storageId: blob,
        sizeBytes: 6,
        attached: true,
        expiresAt: Date.now(),
      });
      const buildId = await ctx.db.insert("builds", {
        userId: "bob",
        name: "Retained",
        status: "idea",
      });
      const imageRefs = [{ kind: "cloud" as const, storageId: blob, imageKey: "shared" }];
      const progress = await ctx.db.insert("buildProgressUpdates", {
        userId: "bob",
        buildId,
        createdAt: 1,
        publishedToFeed: false,
        imageRefs,
      });
      for (let i = 0; i < 6; i++)
        await ctx.db.insert("buildProgressUpdates", {
          userId: "bob",
          buildId,
          createdAt: 1,
          publishedToFeed: false,
          imageRefs: [],
        });
      return { blob, progress, imageRefs };
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await advanceTo(t, jobId, deletion.DELETION_TABLES.length);
    await t.run((ctx) => deletion.stepDeletion(ctx, jobId));
    expect(JSON.parse((await t.run((ctx) => ctx.db.get(jobId)))!.cursor!).table).toBe(9);
    await t.withIdentity({ subject: "bob" }).mutation(api.buildProgressUpdates.update, {
      id: fixture.progress,
      imageRefs: fixture.imageRefs,
    });
    await finish(t);
    expect((await t.query(status, { jobId }))?.status).toBe("complete");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", fixture.blob))).not.toBeNull();
    expect(await rows(t, "storageClaims")).toMatchObject([
      { userId: "bob", storageId: fixture.blob },
    ]);
  });

  it("checkpoints oversized legacy photo arrays under a strict per-transaction write budget", async () => {
    const t = convexTest({ schema, modules, transactionLimits: { documentsWritten: 200 } });
    await user(t);
    const storageIds: Id<"_storage">[] = [];
    for (let start = 0; start < 257; start += 50) {
      const ids = await t.run(async (ctx) => {
        const batch = [];
        for (let i = start; i < Math.min(257, start + 50); i++)
          batch.push(await ctx.storage.store(new Blob([`photo-${i}`])));
        return batch;
      });
      storageIds.push(...ids);
    }
    const progressIds = await t.run(async (ctx) => {
      const buildId = await ctx.db.insert("builds", {
        userId: "alice",
        name: "Historical",
        status: "idea",
      });
      const imageRefs = Array.from({ length: 8192 }, (_, i) => ({
        kind: "cloud" as const,
        storageId: storageIds[i % storageIds.length],
        imageKey: `photo-${i}`,
      }));
      const ids = [];
      for (let i = 0; i < 2; i++)
        ids.push(
          await ctx.db.insert("buildProgressUpdates", {
            userId: "alice",
            buildId,
            createdAt: 1,
            publishedToFeed: false,
            imageRefs,
          })
        );
      return ids;
    });
    const jobId = await t.mutation(begin, { externalId: "alice" });
    await advanceTo(t, jobId, deletion.DELETION_TABLES.indexOf("buildProgressUpdates"));
    await t.run((ctx) => deletion.stepDeletion(ctx, jobId));
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.assetOffset).toBe(0);
    await t.run((ctx) => deletion.stepDeletion(ctx, jobId));
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.assetOffset).toBe(100);
    expect(await rows(t, "accountDeletionAssets")).toHaveLength(100);
    for (let i = 0; i < 82; i++) await t.run((ctx) => deletion.stepDeletion(ctx, jobId));
    expect(await t.run((ctx) => ctx.db.get(progressIds[0]))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(progressIds[1]))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get(jobId)))?.assetOffset).toBe(0);
  });

  it("dispatches the auth deletion hook through an action-capable context without requiring db", async () => {
    const t = convexTest(schema, modules);
    await user(t);
    let hook:
      ReturnType<typeof createAuthOptions>["user"]["deleteUser"]["beforeDelete"] | undefined;
    await t.run((ctx) => {
      const options = createAuthOptions({
        auth: ctx.auth,
        storage: ctx.storage,
        scheduler: ctx.scheduler,
        runAction: t.action,
        runMutation: t.mutation,
        runQuery: t.query,
        vectorSearch: async () => [],
      });
      hook = options.user.deleteUser.beforeDelete;
    });
    await hook!({
      id: "alice",
      email: "alice@example.invalid",
      name: "Alice",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await finish(t);
    expect(await rows(t, "users")).toHaveLength(0);
  });
});
