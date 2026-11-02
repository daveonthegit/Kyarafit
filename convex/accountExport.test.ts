import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import schema from "./schema";
import { EXPORT_COLLECTIONS, type ExportCollection } from "./lib/exportCollections";

const modules = import.meta.glob("./**/*.ts");

async function seed(ctx: MutationCtx, userId: string, storage: Id<"_storage">) {
  const ids = new Map<ExportCollection, Id<ExportCollection>>();
  async function add<T extends ExportCollection>(table: T, value: WithoutSystemFields<Doc<T>>) {
    const id = await ctx.db.insert(table, value);
    ids.set(table, id);
    return id;
  }
  const user = await add("users", { externalId: userId, email: `${userId}@example.com`, tier: "free", currentUsageMb: 0, bio: "I sew", stripeCustomerId: "billing-secret", stripeSubscriptionId: "subscription-secret" });
  const build = await add("builds", { userId, name: "Dress", status: "wip", notes: "Silk", shareToken: "sharing-secret" });
  const node = await add("cosplayNodes", { userId, buildId: build, name: "Cape", nodeType: "element", tags: [], notes: "Red lining" });
  const convention = await add("conventions", { userId, name: "Expo", startDate: "2026-11-01", endDate: "2026-11-02" });
  const group = await add("groups", { createdBy: userId, name: "Friends", visibility: "private", createdAt: 1 });
  const template = await add("workflowTemplates", { userId, name: "Travel", slug: `${userId}:travel`, isBuiltIn: false });
  const task = await add("workflowItems", { userId, title: "Book hotel", notes: "Near venue", reminders: [{ kind: "date", date: "2026-11-01" }], kind: "task", category: "admin", status: "not_started", ancestorIds: [], sortOrder: 0, scopeKind: "shared", sourceKind: "manual" });
  const closet = await add("closetItems", { userId, name: "Wig", category: "wig", tags: [], notes: "Legacy" });
  await add("packingListItems", { userId, conventionId: convention, label: "Wig", notes: "Box", checked: false });
  await add("conventionDayPlans", { userId, conventionId: convention, buildId: build, date: "2026-11-01", notes: "Meet friends" });
  await add("buildTasks", { userId, buildId: build, label: "Cut", sortOrder: 0, checked: true });
  await add("workflowAttachments", { userId, workflowItemId: task, entityType: "convention", entityId: convention, entityKey: `convention:${convention}`, role: "primary" });
  await add("workflowDependencies", { userId, predecessorWorkflowItemId: task, successorWorkflowItemId: task, relationKind: "finish_to_start" });
  await add("workflowTemplateItems", { templateId: template, templateItemKey: "hotel", sortOrder: 0, title: "Hotel", notes: "Refundable", kind: "task", category: "admin", status: "not_started" });
  await add("buildReferenceImages", { userId, buildId: build, imageStorageId: storage, sortOrder: 1 });
  await add("buildProcessPictures", { userId, buildId: build, imageUrl: "https://example.com/seam.jpg", sortOrder: 2 });
  await add("buildProgressUpdates", { userId, buildId: build, createdAt: 1, note: "Finished seams", imageRefs: [{ kind: "cloud", storageId: storage, imageKey: "seams" }], progressPercent: 40, publishedToFeed: false });
  await add("cosplayNodeLinks", { userId, parentNodeId: node, childNodeId: node, sortOrder: 0, linkMode: "shared" });
  await add("buildCosplayLinks", { userId, buildId: build, cosplayNodeId: node, sortOrder: 0 });
  await add("buildNodeStates", { userId, buildId: build, cosplayNodeId: node, directCostCents: 100 });
  await add("buildItemLinks", { userId, buildId: build, closetItemId: closet });
  await add("groupMembers", { userId, groupId: group, role: "admin" });
  await add("groupConventionDays", { groupId: group, conventionId: convention, date: "2026-11-01" });
  await add("follows", { followerId: userId, followingId: "friend" });
  await add("buildLikes", { userId, buildId: build });
  await add("buildComments", { userId, buildId: build, body: "Great seams", createdAt: 1 });
  await add("buildCollaborators", { userId, buildId: build, role: "editor" });
  await add("activities", { userId, kind: "build_created", buildId: build, createdAt: 1 });
  await add("userPushPreferences", { userId: user, marketingOptIn: false, transactionalOptIn: true, updatedAt: 1, expoPushToken: "push-secret" });
  await add("broadcasts", { createdBy: user, title: "News", body: "Meetup", audience: "all", scheduledAt: 1, createdAt: 1 });
  await add("replicaRows", { userId, table: "builds", rowId: "local", doc: { notes: "Offline" }, fieldRevs: {}, deleted: false, rev: 1 });
  await add("replicaConflicts", { userId, table: "builds", rowId: "local", kind: "update", lost: { notes: "Earlier" }, rev: 1, createdAt: 1, dismissed: false });
  await add("replicaAssets", { userId, imageKey: "seams", imageStorageId: storage, createdAt: 1 });
  return Object.fromEntries(await Promise.all([...ids].map(async ([table, id]) => [table, await ctx.db.get(id)])));
}

describe("owner-scoped account export", () => {
  it("revokes group and schedule export access when a creator is removed", async () => {
    const t = convexTest(schema, modules);
    const own = await t.run(async (ctx) => seed(ctx, "alice", await ctx.storage.store(new Blob(["photo"]))));
    const other = await t.run(async (ctx) => seed(ctx, "bob", await ctx.storage.store(new Blob(["other photo"]))));
    const groupId = own.groups._id as Id<"groups">;
    await t.run(async (ctx) => {
      await ctx.db.insert("groupMembers", { groupId, userId: "bob", role: "admin" });
    });
    const alice = t.withIdentity({ subject: "alice" });
    const bob = t.withIdentity({ subject: "bob" });
    for (const collection of ["groups", "groupConventionDays"] as const) {
      expect(await alice.query(api.accountExport.listCollection, { collection })).toEqual([own[collection]]);
    }

    await bob.mutation(api.groups.removeMember, { groupId, removeUserId: "alice" });
    await bob.mutation(api.groups.update, { id: groupId, description: "Changed after removal" });
    await bob.mutation(api.groupConventionDays.addDay, {
      groupId,
      conventionId: other.conventions._id as Id<"conventions">,
      date: "2026-11-02",
    });
    expect(await alice.query(api.groups.get, { id: groupId })).toBeNull();
    expect(await alice.query(api.groupConventionDays.listForGroup, { groupId })).toEqual([]);
    for (const collection of ["groups", "groupConventionDays"] as const) {
      expect(await alice.query(api.accountExport.listCollection, { collection })).toEqual([]);
    }

    await t.run(async (ctx) => {
      await ctx.db.insert("groupMembers", { groupId, userId: "alice", role: "member" });
    });
    expect(await alice.query(api.accountExport.listCollection, { collection: "groups" })).toEqual([
      expect.objectContaining({ _id: groupId, description: "Changed after removal" }),
    ]);
    expect(await alice.query(api.accountExport.listCollection, { collection: "groupConventionDays" })).toHaveLength(2);
  });

  it.each(EXPORT_COLLECTIONS)("exports full owned %s rows but never another account's rows", async (collection) => {
    const t = convexTest(schema, modules);
    const own = await t.run(async (ctx) => seed(ctx, "alice", await ctx.storage.store(new Blob(["photo"]))));
    await t.run(async (ctx) => seed(ctx, "bob", await ctx.storage.store(new Blob(["other photo"]))));
    const expected = { ...own[collection] };
    if (collection === "builds") delete expected.shareToken;
    if (collection === "users") {
      delete expected.stripeCustomerId;
      delete expected.stripeSubscriptionId;
    }
    if (collection === "userPushPreferences") delete expected.expoPushToken;
    expect(await t.withIdentity({ subject: "alice" }).query(api.accountExport.listCollection, { collection })).toEqual([expected]);
    expect(await t.withIdentity({ subject: "empty" }).query(api.accountExport.listCollection, { collection })).toEqual([]);
    await expect(t.query(api.accountExport.listCollection, { collection })).rejects.toThrow("Unauthorized");
  });
});
