/**
 * Authorization regression tests for the containment change.
 *
 * Two properties are the point of these tests, and they are asserted for a
 * representative function in every module:
 *
 *  1. A caller who passes *someone else's* id cannot act as them — the acting user
 *     comes from the session, so the argument is inert.
 *  2. An unauthenticated caller is rejected — reads return nothing, writes throw.
 *
 * A third group pins down what must stay open: the public discover feed, public
 * profiles, public and unlisted share pages, and the images on them.
 */
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// `convex-test` needs Vite's `import.meta.glob` to enumerate the function modules.
// The Convex tsconfig has no `vite/client` types, so declare just what is used here.
declare global {
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.ts");

const ALICE = "alice-external-id";
const BOB = "bob-external-id";
const CAROL = "carol-external-id";

function harness() {
  return convexTest(schema, modules);
}

type Fixture = {
  bobPrivateBuild: Id<"builds">;
  bobPublicBuild: Id<"builds">;
  bobUnlistedBuild: Id<"builds">;
  bobUnlistedToken: string;
  bobConvention: Id<"conventions">;
  bobNode: Id<"cosplayNodes">;
  bobGroup: Id<"groups">;
  bobWorkflowItem: Id<"workflowItems">;
  bobPrivateImage: Id<"_storage">;
  bobPublicBuildImage: Id<"_storage">;
  bobUnlistedBuildImage: Id<"_storage">;
  bobAvatar: Id<"_storage">;
  bobConventionImage: Id<"_storage">;
};

/** Bob owns everything here; Alice owns nothing. Alice is the attacker in most tests. */
async function seed(t: ReturnType<typeof harness>): Promise<Fixture> {
  return await t.run(async (ctx) => {
    const bobAvatar = await ctx.storage.store(new Blob(["bob-avatar"]));
    const bobPrivateImage = await ctx.storage.store(new Blob(["bob-private"]));
    const bobPublicBuildImage = await ctx.storage.store(new Blob(["bob-public"]));
    const bobUnlistedBuildImage = await ctx.storage.store(new Blob(["bob-unlisted"]));
    const bobConventionImage = await ctx.storage.store(new Blob(["bob-convention"]));

    await ctx.db.insert("users", {
      externalId: BOB,
      email: "bob@example.test",
      name: "Bob",
      username: "bob",
      profileVisibility: "public",
      imageStorageId: bobAvatar,
      tier: "FREE",
      currentUsageMb: 0,
    });
    await ctx.db.insert("users", {
      externalId: ALICE,
      email: "alice@example.test",
      name: "Alice",
      username: "alice",
      profileVisibility: "private",
      tier: "FREE",
      currentUsageMb: 0,
    });
    await ctx.db.insert("users", {
      externalId: CAROL,
      email: "carol@example.test",
      tier: "FREE",
      currentUsageMb: 0,
    });

    const bobPrivateBuild = await ctx.db.insert("builds", {
      userId: BOB,
      name: "Bob secret build",
      status: "wip",
      notes: "private notes",
      visibility: "private",
      imageStorageId: bobPrivateImage,
      shareToken: "private-token-should-not-leak",
    });
    const bobPublicBuild = await ctx.db.insert("builds", {
      userId: BOB,
      name: "Bob public build",
      status: "ready",
      visibility: "public",
      imageStorageId: bobPublicBuildImage,
    });
    const bobUnlistedToken = "unlisted-share-token";
    const bobUnlistedBuild = await ctx.db.insert("builds", {
      userId: BOB,
      name: "Bob unlisted build",
      status: "wip",
      visibility: "unlisted",
      shareToken: bobUnlistedToken,
      imageStorageId: bobUnlistedBuildImage,
    });

    const bobConvention = await ctx.db.insert("conventions", {
      userId: BOB,
      name: "Bob's con",
      location: "Somewhere real",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      imageStorageId: bobConventionImage,
    });
    await ctx.db.insert("conventionDayPlans", {
      userId: BOB,
      conventionId: bobConvention,
      date: "2026-09-01",
    });
    await ctx.db.insert("packingListItems", {
      userId: BOB,
      conventionId: bobConvention,
      label: "Wig",
      checked: false,
    });

    const bobNode = await ctx.db.insert("cosplayNodes", {
      userId: BOB,
      nodeType: "element",
      name: "Bob's helmet",
      tags: [],
    });
    await ctx.db.insert("buildCosplayLinks", {
      userId: BOB,
      buildId: bobPrivateBuild,
      cosplayNodeId: bobNode,
      sortOrder: 0,
    });

    const bobGroup = await ctx.db.insert("groups", {
      name: "Bob's private group",
      createdBy: BOB,
      visibility: "private",
      createdAt: 1_760_000_000_000,
    });
    await ctx.db.insert("groupMembers", { groupId: bobGroup, userId: BOB, role: "admin" });
    await ctx.db.insert("groupConventionDays", {
      groupId: bobGroup,
      conventionId: bobConvention,
      date: "2026-09-01",
    });

    const bobWorkflowItem = await ctx.db.insert("workflowItems", {
      userId: BOB,
      title: "Bob's task",
      kind: "task",
      category: "craft",
      status: "not_started",
      ancestorIds: [],
      sortOrder: 0,
      scopeKind: "build_specific",
      sourceKind: "manual",
    });
    await ctx.db.insert("workflowAttachments", {
      userId: BOB,
      workflowItemId: bobWorkflowItem,
      entityType: "cosplayNode",
      entityId: bobNode,
      entityKey: `cosplayNode:${bobNode}`,
      role: "primary",
    });
    await ctx.db.insert("workflowTemplates", {
      userId: BOB,
      slug: `${BOB}:bobs-template`,
      name: "Bob's template",
      isBuiltIn: false,
    });

    return {
      bobPrivateBuild,
      bobPublicBuild,
      bobUnlistedBuild,
      bobUnlistedToken,
      bobConvention,
      bobNode,
      bobGroup,
      bobWorkflowItem,
      bobPrivateImage,
      bobPublicBuildImage,
      bobUnlistedBuildImage,
      bobAvatar,
      bobConventionImage,
    };
  });
}

describe("an unauthenticated caller is rejected", () => {
  test("reads that used to return another user's data now return nothing", async () => {
    const t = harness();
    const f = await seed(t);

    expect(await t.query(api.users.getByExternalId, { externalId: BOB })).toBeNull();
    expect(await t.query(api.users.getMe, { externalId: BOB })).toBeNull();
    expect(await t.query(api.users.getFocusedBuildId, { externalId: BOB })).toBeNull();

    expect(await t.query(api.builds.list, { userId: BOB })).toEqual([]);
    expect(await t.query(api.builds.listWithDetails, { userId: BOB })).toEqual([]);
    expect(await t.query(api.builds.getMostRecentForUser, { userId: BOB })).toBeNull();
    expect(await t.query(api.builds.getFocusedOrMostRecentForUser, { userId: BOB })).toBeNull();
    expect(await t.query(api.builds.listSharedWithUser, { userId: BOB })).toEqual([]);
    expect(await t.query(api.builds.get, { id: f.bobPrivateBuild })).toBeNull();
    expect(await t.query(api.builds.getItems, { buildId: f.bobPrivateBuild })).toEqual([]);
    expect(
      await t.query(api.builds.getSummary, { buildId: f.bobPrivateBuild, userId: BOB })
    ).toBeNull();
    expect(await t.query(api.builds.getBuildsUsingNode, { cosplayNodeId: f.bobNode })).toEqual([]);
    expect(await t.query(api.builds.listByGroup, { groupId: f.bobGroup })).toEqual([]);

    expect(await t.query(api.conventions.list, { userId: BOB })).toEqual([]);
    expect(await t.query(api.conventions.listWithDetails, { userId: BOB })).toEqual([]);
    expect(await t.query(api.conventions.get, { id: f.bobConvention })).toBeNull();
    expect(await t.query(api.conventions.getPlan, { conventionId: f.bobConvention })).toEqual([]);
    expect(await t.query(api.conventions.getPacking, { conventionId: f.bobConvention })).toEqual(
      []
    );
    expect(await t.query(api.conventions.listUpcomingWithPlanCounts, { userId: BOB })).toEqual([]);

    expect(await t.query(api.cosplayNodes.list, { userId: BOB })).toEqual([]);
    expect(await t.query(api.cosplayNodes.get, { id: f.bobNode })).toBeNull();
    expect(await t.query(api.cosplayNodes.listChildren, { parentNodeId: f.bobNode })).toEqual([]);
    expect(await t.query(api.closetItems.list, { userId: BOB })).toEqual([]);

    expect(await t.query(api.groups.get, { id: f.bobGroup })).toBeNull();
    expect(await t.query(api.groups.listForUser, { userId: BOB })).toEqual([]);
    expect(
      await t.query(api.groups.getWithMembers, { groupId: f.bobGroup, userId: BOB })
    ).toBeNull();
    expect(await t.query(api.groupConventionDays.listForGroup, { groupId: f.bobGroup })).toEqual(
      []
    );
    expect(
      await t.query(api.groupConventionDays.listForGroupWithConventions, { groupId: f.bobGroup })
    ).toEqual([]);
    expect(
      await t.query(api.groupConventionDays.listGroupsForConvention, {
        conventionId: f.bobConvention,
      })
    ).toEqual([]);

    expect(await t.query(api.buildTasks.listByCosplayNode, { cosplayNodeId: f.bobNode })).toEqual(
      []
    );
    expect(await t.query(api.workflow.listNodeWorkflow, { cosplayNodeId: f.bobNode })).toBeNull();
    expect(
      await t.query(api.workflow.getBuildProgressSnapshot, { buildId: f.bobPrivateBuild })
    ).toBeNull();
    expect(await t.query(api.workflow.listTemplates, { userId: BOB })).toEqual([]);

    expect(
      await t.query(api.buildCollaborators.listByBuild, { buildId: f.bobPrivateBuild, userId: BOB })
    ).toEqual([]);
    expect(
      await t.query(api.buildCollaborators.listBuildIdsSharedWithUser, { userId: BOB })
    ).toEqual([]);
    expect(
      await t.query(api.buildCollaborators.canEdit, { buildId: f.bobPrivateBuild, userId: BOB })
    ).toBe(false);
    expect(await t.query(api.buildCollaborators.canView, { buildId: f.bobPrivateBuild })).toBe(
      false
    );

    expect(await t.query(api.follows.listFollowerIds, { followingId: BOB })).toEqual([]);
    expect(await t.query(api.follows.listFollowingIds, { followerId: BOB })).toEqual([]);
    expect(await t.query(api.follows.isFollowing, { followerId: BOB, followingId: CAROL })).toBe(
      false
    );
    expect(
      await t.query(api.buildLikes.isLikedBy, { userId: BOB, buildId: f.bobPublicBuild })
    ).toBe(false);
  });

  test("a private build's share token is not readable", async () => {
    const t = harness();
    const f = await seed(t);
    expect(await t.query(api.builds.get, { id: f.bobPrivateBuild })).toBeNull();
    // Nor by guessing at the token index with the wrong token.
    expect(await t.query(api.builds.getByShareToken, { shareToken: "wrong" })).toBeNull();
  });

  test("writes throw", async () => {
    const t = harness();
    const f = await seed(t);

    await expect(t.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.users.upsert, { externalId: BOB, email: "attacker@evil.test" })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.builds.removeMany, { ids: [f.bobPrivateBuild], userId: BOB })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.builds.remove, { id: f.bobPrivateBuild, userId: BOB })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.builds.update, { id: f.bobPrivateBuild, userId: BOB, visibility: "public" })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.conventions.removeMany, { ids: [f.bobConvention], userId: BOB })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.cosplayNodes.removeMany, { ids: [f.bobNode], userId: BOB })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.workflow.remove, { id: f.bobWorkflowItem, userId: BOB })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.groups.remove, { groupId: f.bobGroup, userId: BOB })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.groups.addMember, {
        groupId: f.bobGroup,
        userId: BOB,
        newUserId: ALICE,
        role: "admin",
      })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.buildCollaborators.set, {
        buildId: f.bobPrivateBuild,
        ownerId: BOB,
        userId: ALICE,
        role: "editor",
      })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.follows.follow, { followerId: BOB, followingId: CAROL })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.buildComments.add, { userId: BOB, buildId: f.bobPublicBuild, body: "hi" })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.buildLikes.unlike, { userId: BOB, buildId: f.bobPublicBuild })
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      t.mutation(api.cosplayMigration.migrateClosetItemsToCosplayNodes, {})
    ).rejects.toThrow(/Unauthorized/);

    // Nothing was destroyed.
    await t.run(async (ctx) => {
      expect(await ctx.db.get(f.bobPrivateBuild)).not.toBeNull();
      expect(await ctx.db.get(f.bobConvention)).not.toBeNull();
      expect(await ctx.db.get(f.bobNode)).not.toBeNull();
      expect(await ctx.db.get(f.bobWorkflowItem)).not.toBeNull();
      expect((await ctx.db.get(f.bobPrivateBuild))?.visibility).toBe("private");
    });
  });
});

describe("a caller passing another user's id cannot act as them", () => {
  test("reads scoped by an actor id return the session's own data, not the id's", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    // Alice owns no builds, conventions or elements. Passing Bob's id yields hers.
    expect(await asAlice.query(api.builds.list, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.builds.listWithDetails, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.builds.getMostRecentForUser, { userId: BOB })).toBeNull();
    expect(await asAlice.query(api.conventions.list, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.conventions.listWithDetails, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.cosplayNodes.list, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.closetItems.list, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.groups.listForUser, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.buildTasks.listForPlanner, { userId: BOB })).toEqual([]);
    expect(await asAlice.query(api.workflow.listPlanner, { userId: BOB })).toEqual([]);

    // Bob's own templates are not returned to Alice.
    const templates = await asAlice.query(api.workflow.listTemplates, { userId: BOB });
    expect(templates.some((row) => row.name === "Bob's template")).toBe(false);

    // The user row lookups return Alice's row regardless of the id supplied.
    const user = await asAlice.query(api.users.getByExternalId, { externalId: BOB });
    expect(user?.externalId).toBe(ALICE);
    expect(user?.email).toBe("alice@example.test");
  });

  test("reads of a specific private resource are refused", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    expect(await asAlice.query(api.builds.get, { id: f.bobPrivateBuild })).toBeNull();
    expect(await asAlice.query(api.builds.getItems, { buildId: f.bobPrivateBuild })).toEqual([]);
    expect(
      await asAlice.query(api.builds.getSummary, { buildId: f.bobPrivateBuild, userId: BOB })
    ).toBeNull();
    expect(
      await asAlice.query(api.builds.getBuildsUsingNode, { cosplayNodeId: f.bobNode })
    ).toEqual([]);
    expect(await asAlice.query(api.builds.listByGroup, { groupId: f.bobGroup })).toEqual([]);
    expect(await asAlice.query(api.conventions.get, { id: f.bobConvention })).toBeNull();
    expect(await asAlice.query(api.conventions.getPlan, { conventionId: f.bobConvention })).toEqual(
      []
    );
    expect(
      await asAlice.query(api.conventions.getPacking, { conventionId: f.bobConvention })
    ).toEqual([]);
    expect(await asAlice.query(api.cosplayNodes.get, { id: f.bobNode })).toBeNull();
    expect(await asAlice.query(api.cosplayNodes.listChildren, { parentNodeId: f.bobNode })).toEqual(
      []
    );
    expect(await asAlice.query(api.groups.get, { id: f.bobGroup })).toBeNull();
    expect(
      await asAlice.query(api.groups.getWithMembers, { groupId: f.bobGroup, userId: BOB })
    ).toBeNull();
    expect(
      await asAlice.query(api.groupConventionDays.listForGroup, { groupId: f.bobGroup })
    ).toEqual([]);
    expect(
      await asAlice.query(api.groupConventionDays.listForGroupWithConventions, {
        groupId: f.bobGroup,
      })
    ).toEqual([]);
    expect(
      await asAlice.query(api.groupConventionDays.listGroupsForConvention, {
        conventionId: f.bobConvention,
      })
    ).toEqual([]);
    expect(
      await asAlice.query(api.buildTasks.listByCosplayNode, { cosplayNodeId: f.bobNode })
    ).toEqual([]);
    expect(
      await asAlice.query(api.workflow.listNodeWorkflow, { cosplayNodeId: f.bobNode })
    ).toBeNull();
    expect(
      await asAlice.query(api.workflow.getBuildProgressSnapshot, { buildId: f.bobPrivateBuild })
    ).toBeNull();
    expect(
      await asAlice.query(api.buildCollaborators.listByBuild, {
        buildId: f.bobPrivateBuild,
        userId: BOB,
      })
    ).toEqual([]);
    // Bob's follower graph is not walkable from Alice's session.
    expect(await asAlice.query(api.follows.listFollowerIds, { followingId: BOB })).toEqual([]);
    expect(await asAlice.query(api.follows.listFollowingIds, { followerId: BOB })).toEqual([]);
  });

  test("destructive writes against another user's data are refused", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    // removeMany / updateStatusMany skip rows they do not own rather than throwing.
    await asAlice.mutation(api.builds.removeMany, { ids: [f.bobPrivateBuild], userId: BOB });
    await asAlice.mutation(api.conventions.removeMany, { ids: [f.bobConvention], userId: BOB });
    await asAlice.mutation(api.cosplayNodes.removeMany, { ids: [f.bobNode], userId: BOB });
    await asAlice.mutation(api.builds.updateStatusMany, {
      ids: [f.bobPrivateBuild],
      userId: BOB,
      status: "archived",
    });

    await expect(
      asAlice.mutation(api.builds.remove, { id: f.bobPrivateBuild, userId: BOB })
    ).rejects.toThrow();
    await expect(
      asAlice.mutation(api.conventions.remove, { id: f.bobConvention, userId: BOB })
    ).rejects.toThrow();
    await expect(
      asAlice.mutation(api.cosplayNodes.remove, { id: f.bobNode, userId: BOB })
    ).rejects.toThrow();
    await expect(
      asAlice.mutation(api.workflow.remove, { id: f.bobWorkflowItem, userId: BOB })
    ).rejects.toThrow();
    await expect(
      asAlice.mutation(api.groups.remove, { groupId: f.bobGroup, userId: BOB })
    ).rejects.toThrow();

    await t.run(async (ctx) => {
      const build = await ctx.db.get(f.bobPrivateBuild);
      expect(build).not.toBeNull();
      expect(build?.status).toBe("wip");
      expect(await ctx.db.get(f.bobConvention)).not.toBeNull();
      expect(await ctx.db.get(f.bobNode)).not.toBeNull();
      expect(await ctx.db.get(f.bobWorkflowItem)).not.toBeNull();
      expect(await ctx.db.get(f.bobGroup)).not.toBeNull();
    });
  });

  test("a private build cannot be forced public, nor its share token minted", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    await expect(
      asAlice.mutation(api.builds.update, {
        id: f.bobPrivateBuild,
        userId: BOB,
        visibility: "public",
      })
    ).rejects.toThrow(/Not authorized/);
    await expect(
      asAlice.mutation(api.builds.update, {
        id: f.bobPrivateBuild,
        userId: BOB,
        shareToken: "attacker-token",
      })
    ).rejects.toThrow(/Not authorized/);

    await t.run(async (ctx) => {
      const build = await ctx.db.get(f.bobPrivateBuild);
      expect(build?.visibility).toBe("private");
      expect(build?.shareToken).toBe("private-token-should-not-leak");
    });
  });

  test("privilege escalation into a build or group is refused", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    await expect(
      asAlice.mutation(api.buildCollaborators.set, {
        buildId: f.bobPrivateBuild,
        ownerId: BOB,
        userId: ALICE,
        role: "editor",
      })
    ).rejects.toThrow(/not authorized/i);
    await expect(
      asAlice.mutation(api.buildCollaborators.addByEmail, {
        buildId: f.bobPrivateBuild,
        ownerId: BOB,
        email: "alice@example.test",
        role: "editor",
      })
    ).rejects.toThrow(/not authorized/i);
    await expect(
      asAlice.mutation(api.groups.addMember, {
        groupId: f.bobGroup,
        userId: BOB,
        newUserId: ALICE,
        role: "admin",
      })
    ).rejects.toThrow(/Only admins/);
    await expect(
      asAlice.mutation(api.groups.setMemberRole, {
        groupId: f.bobGroup,
        userId: BOB,
        targetUserId: ALICE,
        role: "admin",
      })
    ).rejects.toThrow(/Only admins/);
    await expect(
      asAlice.mutation(api.groups.removeMember, {
        groupId: f.bobGroup,
        userId: BOB,
        removeUserId: BOB,
      })
    ).rejects.toThrow(/Not a member/);

    await t.run(async (ctx) => {
      const collaborators = await ctx.db
        .query("buildCollaborators")
        .withIndex("by_buildId", (q) => q.eq("buildId", f.bobPrivateBuild))
        .collect();
      expect(collaborators).toEqual([]);
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId", (q) => q.eq("groupId", f.bobGroup))
        .collect();
      expect(members.map((m) => m.userId)).toEqual([BOB]);
    });
  });

  test("users.upsert cannot overwrite another user's row or mail an arbitrary address", async () => {
    const t = harness();
    await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    await asAlice.mutation(api.users.upsert, {
      externalId: BOB,
      email: "attacker@evil.test",
      name: "<img src=x onerror=alert(1)>",
    });

    await t.run(async (ctx) => {
      const bob = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", BOB))
        .unique();
      expect(bob?.email).toBe("bob@example.test");
      expect(bob?.name).toBe("Bob");
      // The write landed on Alice's own row instead.
      const alice = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", ALICE))
        .unique();
      expect(alice?.email).toBe("attacker@evil.test");
    });
  });

  test("social writes are attributed to the session, not the supplied id", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    await asAlice.mutation(api.buildComments.add, {
      userId: BOB,
      buildId: f.bobPublicBuild,
      body: "impersonated?",
    });
    await asAlice.mutation(api.buildLikes.like, { userId: BOB, buildId: f.bobPublicBuild });
    await asAlice.mutation(api.follows.follow, { followerId: BOB, followingId: CAROL });

    await t.run(async (ctx) => {
      const comments = await ctx.db
        .query("buildComments")
        .withIndex("by_buildId", (q) => q.eq("buildId", f.bobPublicBuild))
        .collect();
      expect(comments.map((c) => c.userId)).toEqual([ALICE]);

      const likes = await ctx.db
        .query("buildLikes")
        .withIndex("by_buildId", (q) => q.eq("buildId", f.bobPublicBuild))
        .collect();
      expect(likes.map((l) => l.userId)).toEqual([ALICE]);

      const follows = await ctx.db.query("follows").collect();
      expect(follows).toHaveLength(1);
      expect(follows[0].followerId).toBe(ALICE);
      expect(follows[0].followingId).toBe(CAROL);
    });
  });

  test("another user's like cannot be removed", async () => {
    const t = harness();
    const f = await seed(t);
    const bobLike = await t.run(
      async (ctx) => await ctx.db.insert("buildLikes", { userId: BOB, buildId: f.bobPublicBuild })
    );

    await t
      .withIdentity({ subject: ALICE })
      .mutation(api.buildLikes.unlike, { userId: BOB, buildId: f.bobPublicBuild });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(bobLike)).not.toBeNull();
    });
  });

  test("rows are created under the session's id even when another id is supplied", async () => {
    const t = harness();
    await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });

    const build = await asAlice.mutation(api.builds.create, {
      userId: BOB,
      name: "Alice's build",
      status: "idea",
    });
    expect(build?.userId).toBe(ALICE);

    const convention = await asAlice.mutation(api.conventions.create, {
      userId: BOB,
      name: "Alice's con",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
    });
    expect(convention?.userId).toBe(ALICE);

    const node = await asAlice.mutation(api.cosplayNodes.create, {
      userId: BOB,
      nodeType: "element",
      name: "Alice's element",
      tags: [],
    });
    expect(node?.userId).toBe(ALICE);

    const group = await asAlice.mutation(api.groups.create, { userId: BOB, name: "Alice's group" });
    expect(group?.createdBy).toBe(ALICE);
  });

  test("the global closet migration is admin-only, not merely authenticated", async () => {
    const t = harness();
    await seed(t);
    await expect(
      t
        .withIdentity({ subject: ALICE })
        .mutation(api.cosplayMigration.migrateClosetItemsToCosplayNodes, { reset: true })
    ).rejects.toThrow(/Forbidden/);
    await expect(
      t.withIdentity({ subject: ALICE }).query(api.cosplayMigration.getCosplayMigrationStatus, {})
    ).rejects.toThrow(/Forbidden/);
  });
});

describe("media access", () => {
  test("another user's private images are not resolvable", async () => {
    const t = harness();
    const f = await seed(t);

    expect(await t.query(api.files.getUrl, { storageId: f.bobPrivateImage })).toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: f.bobConventionImage })).toBeNull();

    const asAlice = t.withIdentity({ subject: ALICE });
    expect(await asAlice.query(api.files.getUrl, { storageId: f.bobPrivateImage })).toBeNull();
    expect(await asAlice.query(api.files.getUrl, { storageId: f.bobConventionImage })).toBeNull();
  });

  test("the owner and build collaborators can resolve their own images", async () => {
    const t = harness();
    const f = await seed(t);

    const asBob = t.withIdentity({ subject: BOB });
    expect(await asBob.query(api.files.getUrl, { storageId: f.bobPrivateImage })).not.toBeNull();
    expect(await asBob.query(api.files.getUrl, { storageId: f.bobConventionImage })).not.toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.insert("buildCollaborators", {
        buildId: f.bobPrivateBuild,
        userId: ALICE,
        role: "viewer",
      });
    });
    const asAlice = t.withIdentity({ subject: ALICE });
    expect(await asAlice.query(api.files.getUrl, { storageId: f.bobPrivateImage })).not.toBeNull();
  });

  test("uploading requires a session", async () => {
    const t = harness();
    await expect(t.mutation(api.files.generateUploadUrl, {})).rejects.toThrow(/Unauthorized/);
    await expect(
      t.withIdentity({ subject: ALICE }).mutation(api.files.generateUploadUrl, {})
    ).resolves.toBeTruthy();
  });

  test("a freshly uploaded, not-yet-attached blob needs a session but no owner", async () => {
    // Documented residual: the creation modals upload first and preview via getUrl
    // before the owning row exists, so an unattached blob stays readable to any
    // signed-in caller. It is no longer readable anonymously.
    const t = harness();
    const unattached = await t.run(
      async (ctx) => await ctx.storage.store(new Blob(["just-uploaded"]))
    );
    expect(await t.query(api.files.getUrl, { storageId: unattached })).toBeNull();
    expect(
      await t.withIdentity({ subject: ALICE }).query(api.files.getUrl, { storageId: unattached })
    ).not.toBeNull();
  });
});

describe("attaching media requires being able to read it", () => {
  test("another user's private blob cannot be attached to the caller's own rows", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });
    await t.run(async (ctx) => {
      const alice = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", ALICE))
        .unique();
      await ctx.db.patch(alice!._id, { profileVisibility: "public" });
    });
    const aliceBuild = await asAlice.mutation(api.builds.create, { name: "Alice", status: "wip" });
    const aliceNode = await asAlice.mutation(api.cosplayNodes.create, {
      nodeType: "element",
      name: "Alice's prop",
      tags: [],
    });
    const aliceConvention = await asAlice.mutation(api.conventions.create, {
      name: "Alice's con",
      startDate: "2026-09-01",
      endDate: "2026-09-02",
    });
    const aliceGroup = await asAlice.mutation(api.groups.create, {
      name: "Alice's group",
      visibility: "public",
    });
    const storageId = f.bobPrivateImage;

    await expect(asAlice.mutation(api.users.updateProfileImage, { storageId })).rejects.toThrow(
      /Not authorized to use this file/
    );
    const attempts = [
      () =>
        asAlice.mutation(api.builds.create, {
          name: "x",
          status: "wip",
          visibility: "public",
          imageStorageId: storageId,
        }),
      () => asAlice.mutation(api.builds.update, { id: aliceBuild!._id, imageStorageId: storageId }),
      () =>
        asAlice.mutation(api.buildReferenceImages.add, {
          buildId: aliceBuild!._id,
          imageStorageId: storageId,
        }),
      () =>
        asAlice.mutation(api.buildProcessPictures.add, {
          buildId: aliceBuild!._id,
          imageStorageId: storageId,
        }),
      () =>
        asAlice.mutation(api.cosplayNodes.create, {
          nodeType: "element",
          name: "x",
          tags: [],
          imageStorageId: storageId,
        }),
      () =>
        asAlice.mutation(api.cosplayNodes.update, {
          id: aliceNode!._id,
          imageStorageId: storageId,
        }),
      () =>
        asAlice.mutation(api.conventions.create, {
          name: "x",
          startDate: "2026-09-01",
          endDate: "2026-09-02",
          imageStorageId: storageId,
        }),
      () =>
        asAlice.mutation(api.conventions.update, {
          id: aliceConvention!._id,
          imageStorageId: storageId,
        }),
      () =>
        asAlice.mutation(api.groups.create, {
          name: "x",
          visibility: "public",
          imageStorageId: storageId,
        }),
      () => asAlice.mutation(api.groups.update, { id: aliceGroup!._id, imageStorageId: storageId }),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(/Not authorized to use this file/);
    }

    expect(await t.query(api.files.getUrl, { storageId })).toBeNull();
    expect(await asAlice.query(api.files.getUrl, { storageId })).toBeNull();
  });

  test("fresh uploads, readable blobs and collaborator edits can still be attached", async () => {
    const t = harness();
    const f = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE });
    const [fresh, forBob] = await t.run(async (ctx) => [
      await ctx.storage.store(new Blob(["alice-upload"])),
      await ctx.storage.store(new Blob(["alice-upload-for-bob"])),
    ]);

    await asAlice.mutation(api.users.updateProfileImage, { storageId: fresh });
    await asAlice.mutation(api.builds.create, {
      name: "Alice",
      status: "wip",
      imageStorageId: f.bobPublicBuildImage,
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("buildCollaborators", {
        buildId: f.bobPrivateBuild,
        userId: ALICE,
        role: "editor",
      });
    });
    const updated = await asAlice.mutation(api.builds.update, {
      id: f.bobPrivateBuild,
      imageStorageId: forBob,
    });
    expect(updated?.imageStorageId).toBe(forBob);
    await asAlice.mutation(api.buildReferenceImages.add, {
      buildId: f.bobPrivateBuild,
      imageStorageId: f.bobPrivateImage,
    });
  });
});

describe("endpoints that are public by design stay public", () => {
  test("discover, public profiles and public build listings serve anonymous callers", async () => {
    const t = harness();
    const f = await seed(t);

    const discover = await t.query(api.builds.listDiscover, {});
    expect(discover.map((b) => b._id)).toContain(f.bobPublicBuild);
    expect(discover.map((b) => b._id)).not.toContain(f.bobPrivateBuild);
    // The discover feed still hands out the owner id, which the public profile needs.
    expect(discover.find((b) => b._id === f.bobPublicBuild)?.userId).toBe(BOB);

    const profile = await t.query(api.users.getByUsername, { username: "bob" });
    expect(profile?.userId).toBe(BOB);

    const publicBuilds = await t.query(api.builds.listPublicByUser, { userId: BOB });
    expect(publicBuilds.map((b) => b._id)).toEqual([f.bobPublicBuild]);

    // A private profile is still not served.
    expect(await t.query(api.users.getByUsername, { username: "alice" })).toBeNull();
  });

  test("public and unlisted share pages still load without a session", async () => {
    const t = harness();
    const f = await seed(t);

    expect(await t.query(api.builds.get, { id: f.bobPublicBuild })).not.toBeNull();
    expect(
      await t.query(api.builds.get, { id: f.bobUnlistedBuild, shareToken: f.bobUnlistedToken })
    ).not.toBeNull();
    expect(
      await t.query(api.builds.getByShareToken, { shareToken: f.bobUnlistedToken })
    ).not.toBeNull();
    expect(
      await t.query(api.builds.getPublicViewerBundle, { buildId: f.bobPublicBuild })
    ).not.toBeNull();
    expect(
      await t.query(api.builds.getPublicViewerBundle, { shareToken: f.bobUnlistedToken })
    ).not.toBeNull();
    expect(await t.query(api.buildComments.listByBuild, { buildId: f.bobPublicBuild })).toEqual([]);
    expect(await t.query(api.buildLikes.countByBuild, { buildId: f.bobPublicBuild })).toBe(0);
  });

  test("builds.get strips the share token for non-owners", async () => {
    const t = harness();
    const f = await seed(t);
    const asOwner = await t.withIdentity({ subject: BOB }).query(api.builds.get, {
      id: f.bobUnlistedBuild,
    });
    expect(asOwner?.shareToken).toBe(f.bobUnlistedToken);

    const asAnonymous = await t.query(api.builds.get, {
      id: f.bobUnlistedBuild,
      shareToken: f.bobUnlistedToken,
    });
    expect(asAnonymous).not.toBeNull();
    expect(asAnonymous?.shareToken).toBeUndefined();
  });

  test("images on public and unlisted share pages still resolve anonymously", async () => {
    const t = harness();
    const f = await seed(t);

    expect(await t.query(api.files.getUrl, { storageId: f.bobPublicBuildImage })).not.toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: f.bobUnlistedBuildImage })).not.toBeNull();
    // Bob's profile is public, so his avatar is too.
    expect(await t.query(api.files.getUrl, { storageId: f.bobAvatar })).not.toBeNull();
  });

  test("reference and process images of a public build resolve anonymously", async () => {
    const t = harness();
    const f = await seed(t);
    const { publicRef, privateRef } = await t.run(async (ctx) => {
      const publicRefImage = await ctx.storage.store(new Blob(["public-ref"]));
      const privateRefImage = await ctx.storage.store(new Blob(["private-ref"]));
      await ctx.db.insert("buildReferenceImages", {
        userId: BOB,
        buildId: f.bobPublicBuild,
        imageStorageId: publicRefImage,
        sortOrder: 0,
      });
      await ctx.db.insert("buildProcessPictures", {
        userId: BOB,
        buildId: f.bobPrivateBuild,
        imageStorageId: privateRefImage,
        sortOrder: 0,
      });
      return { publicRef: publicRefImage, privateRef: privateRefImage };
    });

    expect(await t.query(api.files.getUrl, { storageId: publicRef })).not.toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: privateRef })).toBeNull();
  });

  test("an element image resolves anonymously only via a public build", async () => {
    const t = harness();
    const f = await seed(t);
    const { onPublic, onPrivate } = await t.run(async (ctx) => {
      const publicNodeImage = await ctx.storage.store(new Blob(["public-node"]));
      const publicNode = await ctx.db.insert("cosplayNodes", {
        userId: BOB,
        nodeType: "element",
        name: "On a public build",
        tags: [],
        imageStorageId: publicNodeImage,
      });
      await ctx.db.insert("buildCosplayLinks", {
        userId: BOB,
        buildId: f.bobPublicBuild,
        cosplayNodeId: publicNode,
        sortOrder: 0,
      });

      // A nested descendant of a public build's element is also on the public page.
      const childImage = await ctx.storage.store(new Blob(["child-node"]));
      const child = await ctx.db.insert("cosplayNodes", {
        userId: BOB,
        nodeType: "material",
        name: "Nested material",
        tags: [],
        imageStorageId: childImage,
      });
      await ctx.db.insert("cosplayNodeLinks", {
        userId: BOB,
        parentNodeId: publicNode,
        childNodeId: child,
        sortOrder: 0,
        linkMode: "owned",
      });

      const privateNodeImage = await ctx.storage.store(new Blob(["private-node"]));
      await ctx.db.patch(f.bobNode, { imageStorageId: privateNodeImage });

      return { onPublic: [publicNodeImage, childImage], onPrivate: privateNodeImage };
    });

    for (const storageId of onPublic) {
      expect(await t.query(api.files.getUrl, { storageId })).not.toBeNull();
    }
    expect(await t.query(api.files.getUrl, { storageId: onPrivate })).toBeNull();
  });

  test("a public group's image resolves anonymously; a private group's does not", async () => {
    const t = harness();
    const f = await seed(t);
    const { publicGroupImage, privateGroupImage } = await t.run(async (ctx) => {
      const publicImage = await ctx.storage.store(new Blob(["public-group"]));
      const privateImage = await ctx.storage.store(new Blob(["private-group"]));
      await ctx.db.insert("groups", {
        name: "Open group",
        createdBy: BOB,
        visibility: "public",
        createdAt: 1_760_000_000_000,
        imageStorageId: publicImage,
      });
      await ctx.db.patch(f.bobGroup, { imageStorageId: privateImage });
      return { publicGroupImage: publicImage, privateGroupImage: privateImage };
    });

    expect(await t.query(api.files.getUrl, { storageId: publicGroupImage })).not.toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: privateGroupImage })).toBeNull();
    expect(
      await t.withIdentity({ subject: BOB }).query(api.files.getUrl, {
        storageId: privateGroupImage,
      })
    ).not.toBeNull();
  });
});

describe("the owner's own flows still work", () => {
  test("Bob reads and edits his own data while still sending the legacy userId argument", async () => {
    const t = harness();
    const f = await seed(t);
    const asBob = t.withIdentity({ subject: BOB });

    expect(await asBob.query(api.builds.list, { userId: BOB })).toHaveLength(3);
    expect(await asBob.query(api.builds.get, { id: f.bobPrivateBuild })).not.toBeNull();
    expect(
      await asBob.query(api.builds.getSummary, { buildId: f.bobPrivateBuild, userId: BOB })
    ).not.toBeNull();
    expect(await asBob.query(api.conventions.list, { userId: BOB })).toHaveLength(1);
    expect(await asBob.query(api.conventions.get, { id: f.bobConvention })).not.toBeNull();
    expect(
      await asBob.query(api.conventions.getPlan, { conventionId: f.bobConvention })
    ).toHaveLength(1);
    expect(
      await asBob.query(api.conventions.getPacking, { conventionId: f.bobConvention })
    ).toHaveLength(1);
    expect(await asBob.query(api.cosplayNodes.get, { id: f.bobNode })).not.toBeNull();
    expect(await asBob.query(api.groups.get, { id: f.bobGroup })).not.toBeNull();
    expect(
      await asBob.query(api.groups.getWithMembers, { groupId: f.bobGroup, userId: BOB })
    ).not.toBeNull();
    expect(
      await asBob.query(api.groupConventionDays.listForGroup, { groupId: f.bobGroup })
    ).toHaveLength(1);
    expect(
      await asBob.query(api.builds.getBuildsUsingNode, { cosplayNodeId: f.bobNode })
    ).toHaveLength(1);
    expect(
      await asBob.query(api.workflow.listNodeWorkflow, { cosplayNodeId: f.bobNode })
    ).not.toBeNull();
    expect(
      await asBob.query(api.workflow.getBuildProgressSnapshot, { buildId: f.bobPrivateBuild })
    ).not.toBeNull();

    const updated = await asBob.mutation(api.builds.update, {
      id: f.bobPrivateBuild,
      userId: BOB,
      name: "Renamed by owner",
    });
    expect(updated?.name).toBe("Renamed by owner");

    await asBob.mutation(api.builds.remove, { id: f.bobPrivateBuild, userId: BOB });
    await t.run(async (ctx) => {
      expect(await ctx.db.get(f.bobPrivateBuild)).toBeNull();
    });
  });

  test("a build owner can still grant and revoke collaborators", async () => {
    const t = harness();
    const f = await seed(t);
    const asBob = t.withIdentity({ subject: BOB });

    await asBob.mutation(api.buildCollaborators.set, {
      buildId: f.bobPrivateBuild,
      ownerId: BOB,
      userId: ALICE,
      role: "editor",
    });
    const list = await asBob.query(api.buildCollaborators.listByBuild, {
      buildId: f.bobPrivateBuild,
      userId: BOB,
    });
    expect(list.map((row) => row.userId)).toEqual([ALICE]);

    // An editor collaborator can edit, and the check no longer trusts the argument.
    const asAlice = t.withIdentity({ subject: ALICE });
    expect(
      await asAlice.query(api.buildCollaborators.canEdit, { buildId: f.bobPrivateBuild })
    ).toBe(true);
    await asAlice.mutation(api.builds.update, {
      id: f.bobPrivateBuild,
      userId: ALICE,
      name: "Edited by collaborator",
    });

    await asBob.mutation(api.buildCollaborators.remove, {
      buildId: f.bobPrivateBuild,
      ownerId: BOB,
      userId: ALICE,
    });
    expect(
      await asAlice.query(api.buildCollaborators.canEdit, { buildId: f.bobPrivateBuild })
    ).toBe(false);
  });

  test("a group admin can still manage members and convention days", async () => {
    const t = harness();
    const f = await seed(t);
    const asBob = t.withIdentity({ subject: BOB });

    await asBob.mutation(api.groups.addMember, {
      groupId: f.bobGroup,
      userId: BOB,
      newUserId: ALICE,
      role: "member",
    });
    const withMembers = await asBob.query(api.groups.getWithMembers, {
      groupId: f.bobGroup,
      userId: BOB,
    });
    expect(withMembers?.members.map((m) => m.userId).sort()).toEqual([ALICE, BOB].sort());
    // Member display names never fall back to an email address.
    expect(withMembers?.members.map((m) => m.name)).not.toContain("alice@example.test");

    await asBob.mutation(api.groupConventionDays.setDays, {
      groupId: f.bobGroup,
      conventionId: f.bobConvention,
      userId: BOB,
      dates: ["2026-09-02"],
    });
    expect(
      await asBob.query(api.groupConventionDays.listForGroup, { groupId: f.bobGroup })
    ).toHaveLength(1);

    // A plain member cannot change days.
    await expect(
      t.withIdentity({ subject: ALICE }).mutation(api.groupConventionDays.setDays, {
        groupId: f.bobGroup,
        conventionId: f.bobConvention,
        userId: BOB,
        dates: [],
      })
    ).rejects.toThrow(/Only group admins/);
  });
});

/**
 * The relationships that must keep working. The owner-vs-attacker cases above pass
 * whether or not these do, which is how four read regressions got through: a
 * collaborator and a group co-member are neither the owner nor an attacker.
 */
describe("legitimate third parties keep their access", () => {
  test("a build collaborator can read the build's elements and their images", async () => {
    const t = harness();
    const f = await seed(t);
    const { childNode, nodeImage, childImage } = await t.run(async (ctx) => {
      await ctx.db.insert("buildCollaborators", {
        buildId: f.bobPrivateBuild,
        userId: ALICE,
        role: "viewer",
      });
      const nodeImage = await ctx.storage.store(new Blob(["collab-node"]));
      await ctx.db.patch(f.bobNode, { imageStorageId: nodeImage });

      // Nested: the child is not linked to the build directly, only through its parent.
      const childImage = await ctx.storage.store(new Blob(["collab-child"]));
      const childNode = await ctx.db.insert("cosplayNodes", {
        userId: BOB,
        nodeType: "material",
        name: "Worbla",
        tags: [],
        imageStorageId: childImage,
      });
      await ctx.db.insert("cosplayNodeLinks", {
        userId: BOB,
        parentNodeId: f.bobNode,
        childNodeId: childNode,
        sortOrder: 0,
        linkMode: "owned",
      });
      return { childNode, nodeImage, childImage };
    });

    const asAlice = t.withIdentity({ subject: ALICE });
    // The explorer passes buildId; the inspector does not. Both must work.
    expect(
      await asAlice.query(api.cosplayNodes.get, { id: f.bobNode, buildId: f.bobPrivateBuild })
    ).not.toBeNull();
    expect((await asAlice.query(api.cosplayNodes.get, { id: f.bobNode }))?.name).toBe(
      "Bob's helmet"
    );
    expect(await asAlice.query(api.cosplayNodes.get, { id: childNode })).not.toBeNull();
    expect(
      await asAlice.query(api.cosplayNodes.listChildren, { parentNodeId: f.bobNode })
    ).toHaveLength(1);
    expect(await asAlice.query(api.files.getUrl, { storageId: nodeImage })).not.toBeNull();
    expect(await asAlice.query(api.files.getUrl, { storageId: childImage })).not.toBeNull();

    // Carol collaborates on nothing.
    const asCarol = t.withIdentity({ subject: CAROL });
    expect(await asCarol.query(api.cosplayNodes.get, { id: f.bobNode })).toBeNull();
    expect(await asCarol.query(api.cosplayNodes.get, { id: childNode })).toBeNull();
    expect(await asCarol.query(api.cosplayNodes.listChildren, { parentNodeId: f.bobNode })).toEqual(
      []
    );
    expect(await asCarol.query(api.files.getUrl, { storageId: nodeImage })).toBeNull();
    expect(await asCarol.query(api.files.getUrl, { storageId: childImage })).toBeNull();
    // And still nothing anonymously.
    expect(await t.query(api.cosplayNodes.get, { id: f.bobNode })).toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: nodeImage })).toBeNull();
  });

  test("a group co-member can open a co-member's private group build and see its image", async () => {
    const t = harness();
    const f = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("groupMembers", { groupId: f.bobGroup, userId: ALICE, role: "member" });
      await ctx.db.patch(f.bobPrivateBuild, { groupId: f.bobGroup });
    });

    const asAlice = t.withIdentity({ subject: ALICE });
    // The card comes from listByGroup, which already listed it...
    expect(await asAlice.query(api.builds.listByGroup, { groupId: f.bobGroup })).toHaveLength(1);
    // ...so the link it points at and the thumbnail on it have to work too.
    const build = await asAlice.query(api.builds.get, { id: f.bobPrivateBuild });
    expect(build?.name).toBe("Bob secret build");
    // Non-owners still get no share token or offline-sync metadata.
    expect(build?.shareToken).toBeUndefined();
    expect(build?.clientId).toBeUndefined();
    expect(build?.version).toBeUndefined();
    expect(await asAlice.query(api.files.getUrl, { storageId: f.bobPrivateImage })).not.toBeNull();

    // Carol is in no group with Bob.
    const asCarol = t.withIdentity({ subject: CAROL });
    expect(await asCarol.query(api.builds.listByGroup, { groupId: f.bobGroup })).toEqual([]);
    expect(await asCarol.query(api.builds.get, { id: f.bobPrivateBuild })).toBeNull();
    expect(await asCarol.query(api.files.getUrl, { storageId: f.bobPrivateImage })).toBeNull();
    expect(await t.query(api.builds.get, { id: f.bobPrivateBuild })).toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: f.bobPrivateImage })).toBeNull();
  });

  test("group co-members resolve each other's avatars without a public profile", async () => {
    const t = harness();
    const f = await seed(t);
    // Carol's profileVisibility is unset, which is the default for every account.
    const carolAvatar = await t.run(async (ctx) => {
      const carolAvatar = await ctx.storage.store(new Blob(["carol-avatar"]));
      const carol = await ctx.db
        .query("users")
        .withIndex("by_externalId", (q) => q.eq("externalId", CAROL))
        .unique();
      await ctx.db.patch(carol!._id, { imageStorageId: carolAvatar });
      await ctx.db.insert("groupMembers", { groupId: f.bobGroup, userId: CAROL, role: "member" });
      return carolAvatar;
    });

    // Bob shares the group with Carol; Alice does not; anonymous never does.
    expect(
      await t.withIdentity({ subject: BOB }).query(api.files.getUrl, { storageId: carolAvatar })
    ).not.toBeNull();
    expect(
      await t.withIdentity({ subject: ALICE }).query(api.files.getUrl, { storageId: carolAvatar })
    ).toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: carolAvatar })).toBeNull();
    // Carol still sees her own.
    expect(
      await t.withIdentity({ subject: CAROL }).query(api.files.getUrl, { storageId: carolAvatar })
    ).not.toBeNull();
  });

  test("an image shared by a private copy and a public original still resolves", async () => {
    // builds.duplicate copies imageStorageId onto a new private build and clones the
    // reference-image rows verbatim, so one blob is referenced at two visibilities.
    const t = harness();
    const f = await seed(t);
    const { sharedBuildImage, sharedReferenceImage } = await t.run(async (ctx) => {
      const publicBuild = await ctx.db.get(f.bobPublicBuild);
      const sharedBuildImage = publicBuild!.imageStorageId!;
      // The private duplicate is inserted after the public original.
      await ctx.db.insert("builds", {
        userId: BOB,
        name: "Copy of Bob public build",
        status: "wip",
        visibility: "private",
        imageStorageId: sharedBuildImage,
      });

      const sharedReferenceImage = await ctx.storage.store(new Blob(["shared-reference"]));
      await ctx.db.insert("buildReferenceImages", {
        userId: BOB,
        buildId: f.bobPublicBuild,
        imageStorageId: sharedReferenceImage,
        sortOrder: 0,
      });
      await ctx.db.insert("buildReferenceImages", {
        userId: BOB,
        buildId: f.bobPrivateBuild,
        imageStorageId: sharedReferenceImage,
        sortOrder: 0,
      });
      return { sharedBuildImage, sharedReferenceImage };
    });

    expect(await t.query(api.files.getUrl, { storageId: sharedBuildImage })).not.toBeNull();
    expect(await t.query(api.files.getUrl, { storageId: sharedReferenceImage })).not.toBeNull();
    // A blob referenced only by private rows is still denied, and must not fall
    // through to the unattached-blob rule.
    expect(await t.query(api.files.getUrl, { storageId: f.bobPrivateImage })).toBeNull();
  });

  test("checkUsernameAvailability answers instead of throwing without a session", async () => {
    const t = harness();
    await seed(t);

    // "bob" is taken, "nobody" is free: an anonymous caller cannot tell them apart.
    const taken = await t.query(api.users.checkUsernameAvailability, { username: "bob" });
    const free = await t.query(api.users.checkUsernameAvailability, { username: "nobody" });
    expect(taken).toEqual({ ...free, normalized: "bob" });
    // Neutral, not "taken": the deployed client renders any falsy `available` as the
    // taken error, which would block a signed-in user during the token-lag window.
    // Uniqueness stays enforced by users.updateProfile.
    expect(taken).toEqual({
      normalized: "bob",
      valid: true,
      available: true,
      reason: "unauthenticated",
    });
    expect(free.available).toBe(true);
    expect(taken.reason).not.toBe("taken");

    // Authenticated behaviour is unchanged, including the current-user branch.
    const asBob = t.withIdentity({ subject: BOB });
    expect(await asBob.query(api.users.checkUsernameAvailability, { username: "bob" })).toEqual({
      normalized: "bob",
      valid: true,
      available: true,
      reason: "current_user",
    });
    expect(
      await t
        .withIdentity({ subject: ALICE })
        .query(api.users.checkUsernameAvailability, { username: "bob" })
    ).toEqual({ normalized: "bob", valid: true, available: false, reason: "taken" });
    expect(await asBob.query(api.users.checkUsernameAvailability, { username: "nobody" })).toEqual({
      normalized: "nobody",
      valid: true,
      available: true,
      reason: null,
    });

    // The neutral answer leans on this: a name that really is taken cannot be saved.
    await expect(
      t.withIdentity({ subject: ALICE }).mutation(api.users.updateProfile, { username: "bob" })
    ).rejects.toThrow(/already taken/);
  });
});
