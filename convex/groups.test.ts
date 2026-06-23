import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Server-side entitlement enforcement for groups + free interactions (PRODUCT_SPEC §3/§5:
// REQ-018 interactions free, REQ-019 group create paid / join free).
const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

/** Insert a users row so server-side entitlement checks resolve a concrete tier. */
async function setTier(
  t: ReturnType<typeof convexTest>,
  userId: string,
  tier: "FREE" | "PRO" | "SUPPORTER"
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      externalId: userId,
      email: `${userId}@example.com`,
      tier,
      currentUsageMb: 0,
    });
  });
}

describe("group create entitlement (REQ-019, server-side enforcement)", () => {
  it("should_block_group_create_for_free_user", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "free-user", "FREE");

    await expect(
      t.mutation(api.groups.create, { userId: "free-user", name: "No can do" })
    ).rejects.toThrow(/upgrade/i);

    const all = await t.run(async (ctx) => ctx.db.query("groups").collect());
    expect(all).toHaveLength(0);
  });

  it("should_allow_group_create_for_paid_user", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "paid-user", "PRO");

    const group = await t.mutation(api.groups.create, {
      userId: "paid-user",
      name: "Squad",
    });
    expect(group?.name).toBe("Squad");

    // Creator is auto-added as an admin member.
    const membership = await t.run(async (ctx) =>
      ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_userId", (q) =>
          q.eq("groupId", group!._id).eq("userId", "paid-user")
        )
        .unique()
    );
    expect(membership?.role).toBe("admin");
  });

  it("should_allow_group_create_for_supporter_user", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "supporter-user", "SUPPORTER");

    const group = await t.mutation(api.groups.create, {
      userId: "supporter-user",
      name: "Supporters",
    });
    expect(group?.name).toBe("Supporters");
  });
});

describe("free interactions stay ungated (REQ-018)", () => {
  it("should_allow_like_comment_follow_join_for_free_user", async () => {
    const t = convexTest(schema, modules);
    await setTier(t, "free-user", "FREE");
    await setTier(t, "paid-owner", "PRO");

    // Free user can like + comment on a build they can see (their own).
    const ownBuild = await t.mutation(api.builds.create, {
      userId: "free-user",
      name: "My build",
      status: "idea",
    });
    const likeId = await t.mutation(api.buildLikes.like, {
      userId: "free-user",
      buildId: ownBuild!._id,
    });
    expect(likeId).toBeTruthy();
    const commentId = await t.mutation(api.buildComments.add, {
      userId: "free-user",
      buildId: ownBuild!._id,
      body: "Looking good!",
    });
    expect(commentId).toBeTruthy();

    // Free user can follow another user.
    await t.mutation(api.follows.follow, {
      followerId: "free-user",
      followingId: "paid-owner",
    });
    const follow = await t.run(async (ctx) =>
      ctx.db
        .query("follows")
        .withIndex("by_follower_following", (q) =>
          q.eq("followerId", "free-user").eq("followingId", "paid-owner")
        )
        .unique()
    );
    expect(follow).not.toBeNull();

    // Free user can join a group (an admin adds them — joining is free).
    const group = await t.mutation(api.groups.create, {
      userId: "paid-owner",
      name: "Open squad",
    });
    await t.mutation(api.groups.addMember, {
      groupId: group!._id,
      userId: "paid-owner",
      newUserId: "free-user",
    });
    const membership = await t.run(async (ctx) =>
      ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_userId", (q) =>
          q.eq("groupId", group!._id).eq("userId", "free-user")
        )
        .unique()
    );
    expect(membership).not.toBeNull();
    const myGroups = await t.query(api.groups.listForUser, { userId: "free-user" });
    expect(myGroups).toHaveLength(1);
  });
});
