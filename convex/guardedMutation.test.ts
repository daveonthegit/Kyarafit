import "./mediaTestHelpers.fixture";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import {
  makeFunctionReference,
  mutationGeneric,
  internalMutationGeneric,
  type FunctionArgs,
  type FunctionReference,
} from "convex/server";
import { v } from "convex/values";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { DELETION_TABLES } from "./lib/accountDeletion";
import { isGuardedMutation, guardRegisteredInternalMutation } from "./lib/guardedMutation";
import { migrations, run, runWorkflowMigration } from "./migrations";

const modules = import.meta.glob("./**/*.ts");
const appModules = import.meta.glob([
  "./*.ts",
  "!./*.test.ts",
  "!./*.fixture.ts",
  "!./*.config.ts",
  "!./schema.ts",
  "!./http.ts",
  "!./crons.ts",
]);
type Harness = ReturnType<typeof convexTest>;
const begin = makeFunctionReference<"mutation", { externalId: string }, Id<"accountDeletionJobs">>(
  "accountDeletion:begin"
);
const step = makeFunctionReference<
  "mutation",
  { jobId: Id<"accountDeletionJobs">; revision: number }
>("accountDeletion:step");
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function harness() {
  return convexTest({ schema, modules, transactionLimits: true });
}
async function finish(t: Harness) {
  // The installed runtime accepts this limit; its published .d.ts omits the second parameter.
  await Reflect.apply(t.finishAllScheduledFunctions, t, [vi.runAllTimers, 20000]);
}
async function tick(t: Harness, jobId: Id<"accountDeletionJobs">) {
  const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
  await t.mutation(step, { jobId, revision: job.revision });
}
async function advance(t: Harness, jobId: Id<"accountDeletionJobs">, phase: number) {
  for (let i = 0; i < 10000; i++) {
    const job = (await t.run((ctx) => ctx.db.get(jobId)))!;
    if (job.phase === phase) return;
    expect(job.status).toBe("pending");
    await tick(t, jobId);
  }
  throw new Error("Bounded test progression exhausted");
}
async function invoke(ctx: MutationCtx, registered: object, args: object = {}) {
  // Exercise the real Convex registration consumer without exporting fixture RPC endpoints.
  const handler = Reflect.get(registered, "_handler");
  if (typeof handler !== "function") throw new Error("Not a registered mutation");
  return handler(ctx, args);
}
async function fixture(t: Harness) {
  return t.run(async (ctx) => {
    const profiles = [];
    for (const externalId of ["alice", "bob", "gamma"])
      profiles.push(
        await ctx.db.insert("users", {
          externalId,
          email: `${externalId}@example.invalid`,
          tier: "PRO",
          role: "owner",
          currentUsageMb: 0,
        })
      );
    const alphaBuild = await ctx.db.insert("builds", {
      userId: "alice",
      name: "Alpha",
      status: "idea",
      visibility: "public",
    });
    const betaBuild = await ctx.db.insert("builds", {
      userId: "bob",
      name: "Beta",
      status: "idea",
      visibility: "public",
    });
    await ctx.db.insert("buildCollaborators", {
      buildId: alphaBuild,
      userId: "bob",
      role: "editor",
    });
    const alphaNode = await ctx.db.insert("cosplayNodes", {
      userId: "alice",
      name: "Alpha",
      nodeType: "component",
      tags: [],
      buildId: alphaBuild,
    });
    const betaNode = await ctx.db.insert("cosplayNodes", {
      userId: "bob",
      name: "Beta",
      nodeType: "component",
      tags: [],
      buildId: betaBuild,
    });
    const alphaConvention = await ctx.db.insert("conventions", {
      userId: "alice",
      name: "Alpha",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const betaConvention = await ctx.db.insert("conventions", {
      userId: "bob",
      name: "Beta",
      startDate: "2026-01-01",
      endDate: "2026-01-02",
    });
    const alphaGroup = await ctx.db.insert("groups", {
      createdBy: "alice",
      name: "Alpha",
      visibility: "public",
      createdAt: 1,
    });
    const betaGroup = await ctx.db.insert("groups", {
      createdBy: "bob",
      name: "Beta",
      visibility: "public",
      createdAt: 1,
    });
    for (const groupId of [alphaGroup, betaGroup])
      for (const userId of ["alice", "bob"])
        await ctx.db.insert("groupMembers", { groupId, userId, role: "admin" });
    const task = (userId: string) => ({
      userId,
      title: "Task",
      kind: "task",
      category: "prep",
      status: "not_started",
      sortOrder: 0,
      ancestorIds: [],
      scopeKind: "shared",
      sourceKind: "manual",
      creatorUserId: userId,
      ownerUserId: userId,
    });
    const alphaTask = await ctx.db.insert("workflowItems", {
      ...task("alice"),
      scopeKind: "build_specific",
    });
    const betaTask = await ctx.db.insert("workflowItems", task("bob"));
    const betaPredecessor = await ctx.db.insert("workflowItems", task("bob"));
    await ctx.db.insert("workflowAttachments", {
      userId: "alice",
      workflowItemId: alphaTask,
      entityType: "build",
      entityId: alphaBuild,
      entityKey: `build:${alphaBuild}`,
      role: "primary",
      buildContextId: alphaBuild,
    });
    const alphaTemplate = await ctx.db.insert("workflowTemplates", {
      userId: "alice",
      slug: "alpha-private",
      name: "Alpha",
      isBuiltIn: false,
    });
    const betaTemplate = await ctx.db.insert("workflowTemplates", {
      userId: "bob",
      slug: "beta-private",
      name: "Beta",
      isBuiltIn: false,
    });
    await ctx.db.insert("workflowTemplateItems", {
      templateId: betaTemplate,
      templateItemKey: "root",
      sortOrder: 0,
      title: "Template task",
      kind: "task",
      category: "prep",
      status: "not_started",
    });
    const alphaBroadcast = await ctx.db.insert("broadcasts", {
      createdBy: profiles[0],
      createdAt: 1,
      title: "Alpha",
      body: "Body",
      audience: "all",
      scheduledAt: 1,
    });
    const betaBroadcast = await ctx.db.insert("broadcasts", {
      createdBy: profiles[1],
      createdAt: 1,
      title: "Beta",
      body: "Body",
      audience: "all",
      scheduledAt: 1,
    });
    return {
      alphaProfile: profiles[0],
      betaProfile: profiles[1],
      alphaBuild,
      betaBuild,
      alphaNode,
      betaNode,
      alphaConvention,
      betaConvention,
      alphaGroup,
      betaGroup,
      alphaTask,
      betaTask,
      betaPredecessor,
      alphaTemplate,
      betaTemplate,
      alphaBroadcast,
      betaBroadcast,
    };
  });
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function writer<R extends FunctionReference<"mutation", "public">>(
  family: string,
  ref: R,
  active: (f: Fixture) => FunctionArgs<R>,
  target?: (f: Fixture) => FunctionArgs<R>,
  swept = "workflowDependencies"
) {
  return {
    family,
    swept,
    active: (t: Harness, f: Fixture, actor = "bob") =>
      t.withIdentity({ subject: actor }).mutation(ref, active(f)),
    target: target
      ? (t: Harness, f: Fixture) => t.withIdentity({ subject: "bob" }).mutation(ref, target(f))
      : undefined,
  };
}
const writers = [
  writer(
    "builds",
    api.builds.update,
    (f) => ({ id: f.betaBuild, name: "Active" }),
    (f) => ({ id: f.alphaBuild, name: "Late" })
  ),
  writer(
    "elements",
    api.cosplayNodes.update,
    (f) => ({ id: f.betaNode, name: "Active" }),
    (f) => ({ id: f.alphaNode, name: "Late" })
  ),
  writer(
    "tasks",
    api.buildTasks.create,
    (f) => ({ buildId: f.betaBuild, label: "Active" }),
    (f) => ({ buildId: f.alphaBuild, label: "Late" }),
    "workflowAttachments"
  ),
  writer(
    "workflow",
    api.workflow.update,
    (f) => ({ id: f.betaTask, title: "Active" }),
    (f) => ({ id: f.alphaTask, title: "Late" })
  ),
  writer(
    "dependencies",
    api.workflow.setDependencies,
    (f) => ({
      workflowItemId: f.betaTask,
      dependencies: [
        { predecessorWorkflowItemId: f.betaPredecessor, relationKind: "prerequisite" },
      ],
    }),
    (f) => ({
      workflowItemId: f.betaTask,
      dependencies: [{ predecessorWorkflowItemId: f.alphaTask, relationKind: "prerequisite" }],
    })
  ),
  writer(
    "templates",
    api.workflow.applyTemplate,
    (f) => ({ templateId: f.betaTemplate, attachments: [] }),
    (f) => ({ templateId: f.alphaTemplate, attachments: [] }),
    "workflowTemplateItems"
  ),
  writer(
    "conventions",
    api.conventions.update,
    (f) => ({ id: f.betaConvention, name: "Active" }),
    (f) => ({ id: f.alphaConvention, name: "Late" })
  ),
  writer(
    "planning",
    api.conventions.replacePlan,
    (f) => ({
      conventionId: f.betaConvention,
      plan: [{ date: "2026-01-01", buildId: f.betaBuild }],
      idempotencyKey: "plan",
    }),
    (f) => ({
      conventionId: f.betaConvention,
      plan: [{ date: "2026-01-01", buildId: f.alphaBuild }],
      idempotencyKey: "late-plan",
    }),
    "conventionDayPlans"
  ),
  writer(
    "packing",
    api.conventions.addManualPackingItem,
    (f) => ({ conventionId: f.betaConvention, label: "Active" }),
    (f) => ({ conventionId: f.alphaConvention, label: "Late" }),
    "packingListItems"
  ),
  writer(
    "group days replacement",
    api.groupConventionDays.setDays,
    (f) => ({ groupId: f.betaGroup, conventionId: f.betaConvention, dates: ["2026-01-01"] }),
    (f) => ({ groupId: f.betaGroup, conventionId: f.alphaConvention, dates: ["2026-01-01"] }),
    "groupConventionDays"
  ),
  writer(
    "group day addition",
    api.groupConventionDays.addDay,
    (f) => ({ groupId: f.betaGroup, conventionId: f.betaConvention, date: "2026-01-01" }),
    (f) => ({ groupId: f.betaGroup, conventionId: f.alphaConvention, date: "2026-01-01" }),
    "groupConventionDays"
  ),
  writer(
    "groups",
    api.groups.update,
    (f) => ({ id: f.betaGroup, name: "Active" }),
    (f) => ({ id: f.alphaGroup, name: "Late" }),
    "groupMembers"
  ),
  writer(
    "membership",
    api.groups.addMember,
    (f) => ({ groupId: f.betaGroup, newUserId: "gamma" }),
    (f) => ({ groupId: f.betaGroup, newUserId: "alice" }),
    "groupMembers"
  ),
  writer(
    "collaborators",
    api.buildCollaborators.set,
    (f) => ({ buildId: f.betaBuild, userId: "gamma", role: "editor" }),
    (f) => ({ buildId: f.betaBuild, userId: "alice", role: "editor" }),
    "buildCollaborators"
  ),
  writer(
    "invitations",
    api.buildCollaborators.addByEmail,
    (f) => ({ buildId: f.betaBuild, email: "gamma@example.invalid", role: "editor" }),
    (f) => ({ buildId: f.alphaBuild, email: "gamma@example.invalid", role: "editor" }),
    "buildCollaborators"
  ),
  writer(
    "follows",
    api.follows.follow,
    () => ({ followingId: "gamma" }),
    () => ({ followingId: "alice" }),
    "follows"
  ),
  writer(
    "comments",
    api.buildComments.add,
    (f) => ({ buildId: f.betaBuild, body: "Active" }),
    (f) => ({ buildId: f.alphaBuild, body: "Late" }),
    "buildComments"
  ),
  writer(
    "likes",
    api.buildLikes.like,
    (f) => ({ buildId: f.betaBuild }),
    (f) => ({ buildId: f.alphaBuild }),
    "buildLikes"
  ),
  writer(
    "reference media",
    api.buildReferenceImages.add,
    (f) => ({ buildId: f.betaBuild, imageUrl: "https://example.invalid/ref.png" }),
    (f) => ({ buildId: f.alphaBuild, imageUrl: "https://example.invalid/ref.png" }),
    "buildReferenceImages"
  ),
  writer(
    "process media",
    api.buildProcessPictures.add,
    (f) => ({ buildId: f.betaBuild, imageUrl: "https://example.invalid/process.png" }),
    (f) => ({ buildId: f.alphaBuild, imageUrl: "https://example.invalid/process.png" }),
    "buildProcessPictures"
  ),
  writer(
    "progress media",
    api.buildProgressUpdates.add,
    (f) => ({ buildId: f.betaBuild, note: "Active", imageRefs: [] }),
    (f) => ({ buildId: f.alphaBuild, note: "Late", imageRefs: [] }),
    "buildProgressUpdates"
  ),
  writer(
    "focus",
    api.users.setFocusedBuild,
    (f) => ({ buildId: f.betaBuild }),
    (f) => ({ buildId: f.alphaBuild })
  ),
  writer("profiles", api.users.updateProfile, () => ({ displayName: "Active" })),
  writer("account mirror", api.users.upsert, () => ({
    externalId: "alice",
    email: "bob@example.invalid",
    name: "Active",
  })),
  writer("push tokens", api.push.registerToken, () => ({ token: "synthetic-token" })),
  writer("push consent", api.push.setMarketingOptIn, () => ({ marketingOptIn: true })),
  writer("upload reservations", api.files.generateUploadUrlForSize, () => ({ sizeBytes: 1 })),
  writer("backfill", api.tierTransition.backfillRows, () => ({
    table: "builds",
    rows: [{ clientId: "mirror", name: "Active", status: "idea" }],
  })),
  writer(
    "broadcast creation",
    api.broadcasts.create,
    () => ({
      title: "Active",
      body: "Body",
      audience: "userIds",
      audienceArgs: { userIds: ["gamma"] },
      scheduledAt: 1,
    }),
    () => ({
      title: "Late",
      body: "Body",
      audience: "userIds",
      audienceArgs: { userIds: ["alice"] },
      scheduledAt: 1,
    }),
    "broadcasts"
  ),
  writer(
    "broadcast updates",
    api.broadcasts.update,
    (f) => ({ broadcastId: f.betaBroadcast, title: "Active" }),
    (f) => ({ broadcastId: f.alphaBroadcast, title: "Late" }),
    "broadcasts"
  ),
];

describe("registered writer/deletion interleavings", () => {
  it("uses the guarded registration consumer for every exported app mutation", async () => {
    let count = 0;
    for (const [path, load] of Object.entries(appModules)) {
      const exports = await load();
      for (const [name, value] of Object.entries(exports as Record<string, unknown>)) {
        if (typeof value !== "function" || !Reflect.get(value, "isMutation")) continue;
        expect(isGuardedMutation(value), `${path}:${name}`).toBe(true);
        count++;
      }
    }
    expect(count).toBeGreaterThan(90);
    expect(isGuardedMutation(mutationGeneric({ args: {}, handler: () => null }))).toBe(false);
  });
  it("preserves SDK runner validators and internal visibility", () => {
    const original = migrations.runner();
    for (const registered of [run, runWorkflowMigration]) {
      expect(isGuardedMutation(registered)).toBe(true);
      expect(Reflect.get(registered, "isInternal")).toBe(true);
      for (const key of ["exportArgs", "exportReturns"])
        expect(Reflect.apply(Reflect.get(registered, key), registered, [])).toEqual(
          Reflect.apply(Reflect.get(original, key), original, [])
        );
    }
  });
  it("SDK re-registration guards both arguments and resulting writes", async () => {
    const t = harness();
    const f = await fixture(t);
    const original = internalMutationGeneric({
      args: { buildId: v.id("builds") },
      returns: v.id("builds"),
      handler: async (ctx, args) => {
        await ctx.db.patch(args.buildId, { name: "Active" });
        return args.buildId;
      },
    });
    const registered = guardRegisteredInternalMutation(original);
    await t.run((ctx) => invoke(ctx, registered, { buildId: f.betaBuild }));
    expect((await t.run((ctx) => ctx.db.get(f.betaBuild)))?.name).toBe("Active");
    await t.mutation(begin, { externalId: "alice" });
    await expect(
      t.run((ctx) => invoke(ctx, registered, { buildId: f.alphaBuild }))
    ).rejects.toThrow("Account unavailable");
    const implicitTarget = guardRegisteredInternalMutation(
      internalMutationGeneric({
        args: {},
        handler: (ctx) => ctx.db.patch(f.alphaBuild, { name: "Late" }),
      })
    );
    await expect(t.run((ctx) => invoke(ctx, implicitTarget))).rejects.toThrow(
      "Account unavailable"
    );
    await finish(t);
  });
  for (const entry of writers)
    it(`${entry.family}: active writes survive; deleting actors/targets cannot refill a swept phase`, async () => {
      vi.stubEnv("CONVEX_SITE_URL", "https://fixture.convex.site");
      const t = harness();
      const f = await fixture(t);
      const jobId = await t.mutation(begin, { externalId: "alice" });
      await entry.active(t, f);
      await expect(entry.active(t, f, "alice")).rejects.toThrow("Unauthorized");
      if (entry.target) await expect(entry.target(t, f)).rejects.toThrow("Account unavailable");
      await advance(
        t,
        jobId,
        DELETION_TABLES.indexOf(entry.swept as (typeof DELETION_TABLES)[number]) + 1
      );
      if (entry.target) await expect(entry.target(t, f)).rejects.toThrow("Account unavailable");
      await finish(t);
      expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("complete");
      await expect(entry.active(t, f, "alice")).rejects.toThrow("Unauthorized");
      if (entry.target) await expect(entry.target(t, f)).rejects.toThrow("Account unavailable");
    }, 30000);
});
