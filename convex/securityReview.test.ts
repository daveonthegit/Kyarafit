import "./mediaTestHelpers.fixture";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import schema from "./schema";
import { createAuthAccount } from "./authAccountTestHelpers.fixture";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("verified email grant boundary", () => {
  it("ignores supplied email on insert and update and resolves grants through the verified account", async () => {
    const t = convexTest(schema, modules);
    const attacker = await createAuthAccount(t, "attacker@example.test");
    const actor = t.withIdentity({ subject: attacker });
    await actor.mutation(api.users.upsert, { email: "victim@example.test" });
    await actor.mutation(api.users.upsert, { email: "victim@example.test" });
    expect((await actor.query(api.users.getByExternalId, {}))?.email).toBe("attacker@example.test");
    await expect(
      t.mutation(internal.users.setUserRole, { email: "victim@example.test", role: "owner" })
    ).rejects.toThrow("User not found");
    const victim = await t.run(async (ctx) => {
      const account = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "user",
          data: {
            email: "victim@example.test",
            emailVerified: true,
            name: "Victim",
            createdAt: 1,
            updatedAt: 1,
          },
        },
      });
      await ctx.db.insert("users", {
        externalId: account._id,
        email: "old@example.test",
        tier: "FREE",
        currentUsageMb: 0,
      });
      await ctx.db.patch(
        (await ctx.db
          .query("users")
          .withIndex("by_externalId", (q) => q.eq("externalId", attacker))
          .unique())!._id,
        { email: "victim@example.test" }
      );
      await ctx.db.insert("users", {
        externalId: "operator",
        email: "operator@example.test",
        role: "owner",
        tier: "FREE",
        currentUsageMb: 0,
      });
      return account._id as string;
    });
    await t.mutation(internal.users.setUserRole, { email: " VICTIM@example.test ", role: "admin" });
    await t
      .withIdentity({ subject: "operator" })
      .mutation(api.users.grantRole, { email: "victim@example.test", role: "owner" });
    const build = await t
      .withIdentity({ subject: "operator" })
      .mutation(api.builds.create, { name: "Shared", status: "idea" });
    await t
      .withIdentity({ subject: "operator" })
      .mutation(api.buildCollaborators.addByEmail, {
        buildId: build!._id,
        email: "victim@example.test",
        role: "editor",
      });
    const rows = await t
      .withIdentity({ subject: "operator" })
      .query(api.buildCollaborators.listByBuild, { buildId: build!._id });
    expect(rows.map((r) => r.userId)).toEqual([victim]);
    expect((await actor.query(api.users.getByExternalId, {}))?.role).toBeUndefined();
    expect(
      (await t.withIdentity({ subject: victim }).query(api.users.getByExternalId, {}))?.role
    ).toBe("owner");
  });

  it("rejects unverified recipients on all email-based grant paths", async () => {
    const t = convexTest(schema, modules);
    const subject = await createAuthAccount(t, "unverified@example.test", false);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        externalId: subject,
        email: "unverified@example.test",
        tier: "FREE",
        currentUsageMb: 0,
      });
      await ctx.db.insert("users", {
        externalId: "operator",
        email: "operator@example.test",
        role: "owner",
        tier: "FREE",
        currentUsageMb: 0,
      });
    });
    const operator = t.withIdentity({ subject: "operator" });
    const build = await operator.mutation(api.builds.create, { name: "Shared", status: "idea" });
    await expect(
      t.mutation(internal.users.setUserRole, { email: "unverified@example.test", role: "owner" })
    ).rejects.toThrow("User not found");
    await expect(
      operator.mutation(api.users.grantRole, { email: "unverified@example.test", role: "owner" })
    ).rejects.toThrow("Target user not found");
    await expect(
      operator.mutation(api.buildCollaborators.addByEmail, {
        buildId: build!._id,
        email: "unverified@example.test",
        role: "editor",
      })
    ).rejects.toThrow("No user found");
  });
});

it("suppresses deleting owners before public, group, follower and collaborator alternatives", async () => {
  const t = convexTest(schema, modules);
  const { groupId, buildId, privateId } = await t.run(async (ctx) => {
    for (const externalId of ["alice", "bob"])
      await ctx.db.insert("users", {
        externalId,
        email: `${externalId}@example.test`,
        tier: "FREE",
        currentUsageMb: 0,
      });
    const groupId = await ctx.db.insert("groups", {
      name: "Group",
      createdBy: "alice",
      visibility: "public",
      createdAt: 1,
    });
    for (const userId of ["alice", "bob"])
      await ctx.db.insert("groupMembers", { groupId, userId, role: "admin" });
    const buildId = await ctx.db.insert("builds", {
      userId: "alice",
      name: "Public",
      status: "idea",
      visibility: "public",
      groupId,
      notes: "Private after deletion",
      imageUrl: "https://example.test/image",
    });
    const privateId = await ctx.db.insert("builds", {
      userId: "alice",
      name: "Private",
      status: "idea",
      visibility: "private",
      groupId,
    });
    await ctx.db.insert("buildCollaborators", { buildId, userId: "bob", role: "editor" });
    await ctx.db.insert("follows", { followerId: "bob", followingId: "alice" });
    return { groupId, buildId, privateId };
  });
  const bob = t.withIdentity({ subject: "bob" });
  expect(await bob.query(api.builds.get, { id: privateId })).not.toBeNull();
  expect(await bob.query(api.builds.listFeedFromFollowing, {})).toHaveLength(1);
  expect(await bob.query(api.builds.listByGroup, { groupId })).toHaveLength(2);
  expect(await bob.query(api.builds.listSharedWithUser, {})).toHaveLength(1);
  expect(await bob.query(api.buildCollaborators.listByBuild, { buildId })).toHaveLength(1);
  expect(await bob.query(api.buildCollaborators.listBuildIdsSharedWithUser, {})).toEqual([buildId]);
  expect(await bob.query(api.buildCollaborators.canEdit, { buildId })).toBe(true);
  expect(await t.query(api.groups.get, { id: groupId })).not.toBeNull();
  expect(await bob.query(api.groups.listForUser, {})).toHaveLength(1);
  expect(await bob.query(api.groups.getWithMembers, { groupId })).not.toBeNull();
  const jobId = await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
  for (const failed of [false, true]) {
    if (failed) await t.run((ctx) => ctx.db.patch(jobId, { status: "failed" }));
    expect(await bob.query(api.builds.get, { id: privateId })).toBeNull();
    expect(await bob.query(api.builds.get, { id: buildId })).toBeNull();
    expect(await bob.query(api.builds.listFeedFromFollowing, {})).toEqual([]);
    expect(await bob.query(api.builds.listByGroup, { groupId })).toEqual([]);
    expect(await bob.query(api.builds.listSharedWithUser, {})).toEqual([]);
    expect(await bob.query(api.buildCollaborators.listByBuild, { buildId })).toEqual([]);
    expect(await bob.query(api.buildCollaborators.listBuildIdsSharedWithUser, {})).toEqual([]);
    expect(await bob.query(api.buildCollaborators.canEdit, { buildId })).toBe(false);
    expect(await t.query(api.groups.get, { id: groupId })).toBeNull();
    expect(await bob.query(api.groups.listForUser, {})).toEqual([]);
    expect(await bob.query(api.groups.getWithMembers, { groupId })).toBeNull();
  }
});

it("filters deleting build owners even in a surviving group", async () => {
  const t = convexTest(schema, modules);
  const { groupId, buildId, liveId } = await t.run(async (ctx) => {
    const groupId = await ctx.db.insert("groups", {
      name: "Live",
      createdBy: "bob",
      visibility: "public",
      createdAt: 1,
    });
    for (const userId of ["alice", "bob"])
      await ctx.db.insert("groupMembers", { groupId, userId, role: "admin" });
    const buildId = await ctx.db.insert("builds", {
      userId: "alice",
      name: "Gone",
      status: "idea",
      groupId,
    });
    const liveId = await ctx.db.insert("builds", {
      userId: "bob",
      name: "Live",
      status: "idea",
      groupId,
    });
    await ctx.db.insert("buildCollaborators", { buildId: liveId, userId: "alice", role: "viewer" });
    return { groupId, buildId, liveId };
  });
  await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
  const bob = t.withIdentity({ subject: "bob" });
  expect(await bob.query(api.builds.get, { id: buildId })).toBeNull();
  expect((await bob.query(api.builds.listByGroup, { groupId })).map((b) => b._id)).toEqual([
    liveId,
  ]);
  expect(await bob.query(api.builds.get, { id: liveId })).not.toBeNull();
  expect(await bob.query(api.buildCollaborators.listByBuild, { buildId: liveId })).toEqual([]);
  expect(
    (await bob.query(api.groups.getWithMembers, { groupId }))?.members.map((m) => m.userId)
  ).toEqual(["bob"]);
});
