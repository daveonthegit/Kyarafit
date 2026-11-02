import {
  deriveBuildBlendedProgress,
  deriveStatusProgress,
} from "@kyarafit/design-system/domain/workflowProgress";
import type { VaultDoc } from "../store";
import type {
  LocalMutationCtx,
  LocalMutationHandler,
  LocalQueryCtx,
  LocalQueryHandler,
} from "../types";
import { deriveNodeSummary, type NodeDoc } from "./cosplayNodes";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeString,
  validateDateString,
} from "./lib/validation";
import { entityKey, getWorkflowItemsByAttachmentKey } from "./lib/workflowDomain";
import { getFocusedBuildId } from "./users";
import { getBuildScopedWorkflow, removeWorkflowItemCascade } from "./workflow";

/**
 * Local port of the personal-data parts of `convex/builds.ts`.
 *
 * Same validation, metrics, sorting, cascades, duplicate semantics and return shapes as the server.
 * Dropped because the vault has one owner and does no hosting: identity/collaborator/group access
 * checks, the idempotency ledger, storage-usage accounting, publish entitlement gates and share-token
 * minting. `visibility` / `groupId` are stored as given; publishing is an online concern enforced by
 * the server when (paid) sync replays the change.
 */

type ReadCtx = Pick<LocalQueryCtx, "db" | "userId">;

export type BuildDoc = VaultDoc & {
  version?: number;
  fieldUpdatedAt?: Record<string, number>;
  userId: string;
  name: string;
  character?: string;
  status: string;
  notes?: string;
  imageUrl?: string;
  imageStorageId?: string;
  imageFocalX?: number;
  imageFocalY?: number;
  budgetCents?: number;
  targetDate?: string;
  manualProgressPercent?: number;
  visibility?: string;
  shareToken?: string;
  groupId?: string;
  publicViewerSettings?: Record<string, boolean | undefined>;
};

const VALID_STATUSES = ["idea", "wip", "ready", "archived"] as const;
const VALID_VISIBILITIES = ["private", "unlisted", "public"] as const;

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function getBuild(ctx: ReadCtx, id: unknown): BuildDoc | null {
  if (typeof id !== "string") return null;
  const doc = ctx.db.get(id);
  return doc && "status" in doc && "name" in doc && !("nodeType" in doc) ? (doc as BuildDoc) : null;
}

function getNode(ctx: ReadCtx, id: unknown): NodeDoc | null {
  if (typeof id !== "string") return null;
  const doc = ctx.db.get(id);
  return doc && "nodeType" in doc ? (doc as NodeDoc) : null;
}

/** A build's root nodes: its own cosplayNodes with no parent, ordered by `sortOrder`. */
function getBuildRootNodes(ctx: ReadCtx, buildId: string): NodeDoc[] {
  const buildNodes = ctx.db
    .query("cosplayNodes")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect() as NodeDoc[];
  return buildNodes
    .filter((node) => node.parentNodeId === undefined)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function getBuildRootLinks(ctx: ReadCtx, buildId: string) {
  return getBuildRootNodes(ctx, buildId).map((node) => ({
    cosplayNodeId: node._id,
    sortOrder: node.sortOrder ?? 0,
  }));
}

export function getBuildWorkflowMetrics(ctx: ReadCtx, build: BuildDoc) {
  const scoped = getBuildScopedWorkflow(ctx, build._id);
  const workflowItems = (scoped?.items ?? []) as VaultDoc[];
  const taskItems = workflowItems.filter((item) => item.kind === "task");
  const tasksChecked = taskItems.filter((item) => item.status === "done").length;
  const tasksTotal = taskItems.length;
  const workflowProgressPercent =
    tasksTotal > 0
      ? Math.round((tasksChecked / tasksTotal) * 100)
      : workflowItems.length > 0
        ? Math.round(
            workflowItems.reduce(
              (sum, item) =>
                sum +
                deriveStatusProgress({
                  status: item.status as never,
                  manualProgressPercent: item.manualProgressPercent as number | undefined,
                }),
              0
            ) / workflowItems.length
          )
        : 0;

  const links = getBuildRootLinks(ctx, build._id);
  let totalCostCents = 0;
  const nodeProgressUnits: number[] = [];
  const visited = new Set<string>();
  for (const link of links) {
    const summary = deriveNodeSummary(ctx, link.cosplayNodeId, build._id, visited);
    totalCostCents += summary.totalCostCents;
    nodeProgressUnits.push(summary.progressPercent);
  }
  const nodeProgressPercent =
    nodeProgressUnits.length > 0
      ? Math.round(
          nodeProgressUnits.reduce((sum, value) => sum + value, 0) / nodeProgressUnits.length
        )
      : undefined;
  const packingItems = ctx.db
    .query("packingListItems")
    .withIndex("by_userId", (q) => q.eq("userId", build.userId))
    .collect()
    .filter((item) => item.buildId === build._id);
  const packingProgressPercent =
    packingItems.length > 0
      ? Math.round((packingItems.filter((item) => item.checked).length / packingItems.length) * 100)
      : undefined;
  const progress = deriveBuildBlendedProgress({
    manualProgressPercent: build.manualProgressPercent,
    workflowProgressPercent,
    nodeProgressPercent,
    packingProgressPercent,
  });

  return {
    tasksTotal,
    tasksChecked,
    workflowProgressPercent,
    packingProgressPercent,
    nodeProgressPercent,
    progress,
    totalCostCents,
  };
}

function computeBuildSummaryPayload(ctx: LocalQueryCtx, build: BuildDoc) {
  const {
    tasksChecked,
    tasksTotal,
    progress: progressPercent,
    totalCostCents,
  } = getBuildWorkflowMetrics(ctx, build);

  const links = getBuildRootLinks(ctx, build._id);
  const linkedItemCount = links.length;
  let linkedItemsCompleteCount = 0;
  const visited = new Set<string>();
  for (const link of links) {
    const summary = deriveNodeSummary(ctx, link.cosplayNodeId, build._id, visited);
    if (summary.overallBucket === "complete") linkedItemsCompleteCount += 1;
  }

  const createdMs = build._creationTime ?? ctx.now;
  const createdDate = new Date(createdMs).toISOString().slice(0, 10);
  const elapsedDays = Math.floor((ctx.now - createdMs) / (1000 * 60 * 60 * 24));

  let remainingDays: number | null = null;
  if (build.targetDate) {
    const today = new Date(ctx.now);
    today.setHours(0, 0, 0, 0);
    const targetStart = new Date(build.targetDate);
    targetStart.setHours(0, 0, 0, 0);
    remainingDays = Math.ceil((targetStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const budgetCents = build.budgetCents ?? null;
  const budgetDifferenceCents = budgetCents != null ? budgetCents - totalCostCents : null;

  return {
    status: build.status,
    progressPercent,
    tasksChecked,
    tasksTotal,
    createdDate,
    targetDate: build.targetDate ?? null,
    elapsedDays,
    remainingDays,
    linkedItemCount,
    linkedItemsCompleteCount,
    totalCostCents,
    budgetCents,
    budgetDifferenceCents,
  };
}

function userBuilds(ctx: ReadCtx): BuildDoc[] {
  return ctx.db
    .query("builds")
    .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
    .collect() as BuildDoc[];
}

function withHeroMetrics(ctx: ReadCtx, build: BuildDoc) {
  const { tasksChecked, tasksTotal, progress } = getBuildWorkflowMetrics(ctx, build);
  return { ...build, tasksTotal, tasksChecked, progress };
}

function replaceBuildRootLinks(ctx: LocalMutationCtx, buildId: string, cosplayNodeIds: string[]) {
  const nextIds = new Set(cosplayNodeIds);
  for (const node of getBuildRootNodes(ctx, buildId)) {
    if (!nextIds.has(node._id)) {
      ctx.db.patch(
        node._id,
        withUpdateMeta(node, { buildId: undefined, sortOrder: undefined }, ctx.now)
      );
    }
  }
  for (let index = 0; index < cosplayNodeIds.length; index += 1) {
    const node = getNode(ctx, cosplayNodeIds[index]);
    if (!node || node.userId !== ctx.userId) continue;
    ctx.db.patch(
      node._id,
      withUpdateMeta(node, { buildId, parentNodeId: undefined, sortOrder: index }, ctx.now)
    );
  }
}

function addBuildRootLinks(ctx: LocalMutationCtx, buildId: string, cosplayNodeIds: string[]) {
  const currentRoots = getBuildRootNodes(ctx, buildId);
  const existingIds = new Set(currentRoots.map((node) => node._id));
  let nextSortOrder = currentRoots.length;
  for (const cosplayNodeId of Array.from(new Set(cosplayNodeIds))) {
    if (existingIds.has(cosplayNodeId)) continue;
    const node = getNode(ctx, cosplayNodeId);
    if (!node || node.userId !== ctx.userId) continue;
    ctx.db.patch(
      node._id,
      withUpdateMeta(
        node,
        { buildId, parentNodeId: undefined, sortOrder: nextSortOrder++ },
        ctx.now
      )
    );
  }
}

function removeBuildRootLink(ctx: LocalMutationCtx, buildId: unknown, cosplayNodeId: unknown) {
  const build = getBuild(ctx, buildId);
  if (!build) throw new Error("Build not found");
  const node = getNode(ctx, cosplayNodeId);
  if (!node || node.userId !== ctx.userId) {
    throw new Error("Not found or not authorized");
  }
  if (node.buildId === build._id) {
    ctx.db.patch(
      node._id,
      withUpdateMeta(node, { buildId: undefined, sortOrder: undefined }, ctx.now)
    );
  }
}

/** Cascade a build delete: tasks, build-scoped workflow, galleries; nodes return to the library. */
function deleteBuildCascade(ctx: LocalMutationCtx, build: BuildDoc) {
  const id = build._id;
  const refImages = ctx.db
    .query("buildReferenceImages")
    .withIndex("by_buildId", (q) => q.eq("buildId", id))
    .collect();
  const processPics = ctx.db
    .query("buildProcessPictures")
    .withIndex("by_buildId", (q) => q.eq("buildId", id))
    .collect();
  const tasks = ctx.db
    .query("buildTasks")
    .withIndex("by_buildId", (q) => q.eq("buildId", id))
    .collect();
  for (const t of tasks) ctx.db.delete(t._id);
  const workflowAttachments = ctx.db
    .query("workflowAttachments")
    .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
    .collect()
    .filter((attachment) => attachment.entityType === "build" && attachment.entityId === id);
  for (const attachment of workflowAttachments) {
    const workflowItem =
      typeof attachment.workflowItemId === "string" ? ctx.db.get(attachment.workflowItemId) : null;
    if (workflowItem?.scopeKind === "build_specific") {
      removeWorkflowItemCascade(ctx, workflowItem._id);
    } else if (ctx.db.get(attachment._id)) {
      ctx.db.delete(attachment._id);
    }
  }
  const buildNodes = ctx.db
    .query("cosplayNodes")
    .withIndex("by_buildId", (q) => q.eq("buildId", id))
    .collect() as NodeDoc[];
  for (const n of buildNodes) {
    ctx.db.patch(n._id, withUpdateMeta(n, { buildId: undefined }, ctx.now));
  }
  for (const r of refImages) ctx.db.delete(r._id);
  for (const p of processPics) ctx.db.delete(p._id);
  ctx.db.delete(id);
}

export const queries: Record<string, LocalQueryHandler> = {
  "builds:list": (ctx, args) => {
    const order = args.order === "desc" ? "desc" : "asc";
    const sortBy = str(args.sortBy) ?? "name";
    const status = str(args.status);
    const statusFilter =
      status && VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
        ? status
        : undefined;

    const builds = (
      statusFilter
        ? ctx.db
            .query("builds")
            .withIndex("by_userId_status", (q) =>
              q.eq("userId", ctx.userId).eq("status", statusFilter)
            )
            .collect()
        : userBuilds(ctx)
    ) as BuildDoc[];

    let filtered = builds.map((b) => ({ ...b, ...getBuildWorkflowMetrics(ctx, b) }));
    const searchTrimmed = str(args.search)?.trim();
    if (searchTrimmed) {
      const lower = searchTrimmed.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(lower) || (b.character ?? "").toLowerCase().includes(lower)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        case "progress":
          cmp = (a.progress ?? 0) - (b.progress ?? 0);
          break;
        case "targetDate": {
          cmp = (a.targetDate ?? "").localeCompare(b.targetDate ?? "");
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        case "budget": {
          cmp = (a.budgetCents ?? -1) - (b.budgetCents ?? -1);
          if (cmp === 0) cmp = (a.name ?? "").localeCompare(b.name ?? "");
          break;
        }
        default:
          cmp = (a.name ?? "").localeCompare(b.name ?? "");
      }
      return order === "desc" ? -cmp : cmp;
    });

    return sorted.map(({ progress: _p, ...rest }) => rest);
  },

  "builds:getFocusedOrMostRecentForUser": (ctx) => {
    let build: BuildDoc | null = null;
    const focusedId = getFocusedBuildId(ctx.db);
    if (focusedId) {
      const candidate = getBuild(ctx, focusedId);
      if (candidate && candidate.userId === ctx.userId) build = candidate;
    }
    if (!build) {
      const builds = userBuilds(ctx);
      if (builds.length === 0) return null;
      build = [...builds].sort((a, b) => b._creationTime - a._creationTime)[0];
    }
    return withHeroMetrics(ctx, build);
  },

  "builds:get": (ctx, args) => {
    const build = getBuild(ctx, args.id);
    if (!build) return null;
    const { tasksTotal, tasksChecked, progress, workflowProgressPercent } = getBuildWorkflowMetrics(
      ctx,
      build
    );
    return { ...build, tasksTotal, tasksChecked, progress, workflowProgressPercent };
  },

  "builds:getNodes": (ctx, args) => {
    const build = getBuild(ctx, args.buildId);
    if (!build) return [];
    return getBuildRootLinks(ctx, build._id).map((link) => link.cosplayNodeId);
  },

  "builds:getSummary": (ctx, args) => {
    const build = getBuild(ctx, args.buildId);
    if (!build || build.userId !== ctx.userId) return null;
    return computeBuildSummaryPayload(ctx, build);
  },

  "builds:getBuildsUsingNode": (ctx, args) => {
    const node = getNode(ctx, args.cosplayNodeId);
    if (!node || node.userId !== ctx.userId || node.buildId === undefined) return [];
    const build = getBuild(ctx, node.buildId);
    return build && build.userId === ctx.userId
      ? [
          {
            _id: build._id,
            name: build.name,
            imageStorageId: build.imageStorageId,
            imageUrl: build.imageUrl,
            character: build.character,
          },
        ]
      : [];
  },
};

export const mutations: Record<string, LocalMutationHandler> = {
  "builds:create": (ctx, args) => {
    const visibility = VALID_VISIBILITIES.includes(
      args.visibility as (typeof VALID_VISIBILITIES)[number]
    )
      ? (args.visibility as string)
      : "private";
    const name = sanitizeAndLimit(str(args.name) ?? "", MAX_LENGTH.name, "Name");
    const character = sanitizeOptional(str(args.character), MAX_LENGTH.character, "Character");
    const notes = sanitizeOptional(str(args.notes), MAX_LENGTH.notes, "Notes");
    const rawStatus = str(args.status);
    const status = VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
      ? sanitizeString(rawStatus as string)
      : "idea";
    const targetDate = str(args.targetDate)
      ? validateDateString(args.targetDate as string, "Target date")
      : undefined;
    const id = ctx.db.insert(
      "builds",
      withCreateMeta(
        {
          userId: ctx.userId,
          name,
          character,
          status,
          notes,
          imageUrl: str(args.imageUrl),
          imageStorageId: str(args.imageStorageId),
          budgetCents: typeof args.budgetCents === "number" ? args.budgetCents : undefined,
          targetDate,
          visibility,
        },
        ctx.now
      )
    );
    return ctx.db.get(id);
  },

  "builds:update": (ctx, args) => {
    const { id, userId: _userId, idempotencyKey: _key, ...fields } = args;
    const build = getBuild(ctx, id);
    if (!build) throw new Error("Build not found");
    const patch: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      if (k === "name") patch.name = sanitizeAndLimit(val as string, MAX_LENGTH.name, "Name");
      else if (k === "character")
        patch.character = sanitizeOptional(val as string, MAX_LENGTH.character, "Character");
      else if (k === "notes")
        patch.notes = sanitizeOptional(val as string, MAX_LENGTH.notes, "Notes");
      else if (k === "status") {
        if (VALID_STATUSES.includes(val as (typeof VALID_STATUSES)[number])) {
          patch.status = sanitizeString(val as string);
        }
      } else if (k === "targetDate")
        patch.targetDate = validateDateString(val as string, "Target date");
      else if (k === "imageUrl")
        patch.imageUrl = sanitizeOptional(
          (val as string | null) ?? undefined,
          MAX_LENGTH.url,
          "Image URL"
        );
      else if (k === "imageStorageId") patch.imageStorageId = val === null ? undefined : val;
      else if (k === "imageFocalX" && typeof val === "number")
        patch.imageFocalX = Math.max(0, Math.min(1, val));
      else if (k === "imageFocalY" && typeof val === "number")
        patch.imageFocalY = Math.max(0, Math.min(1, val));
      else if (k === "visibility") {
        if (VALID_VISIBILITIES.includes(val as (typeof VALID_VISIBILITIES)[number])) {
          patch.visibility = val;
          // Share tokens are minted by the server when it accepts the publish; locally only clear.
          if (val !== "unlisted") patch.shareToken = undefined;
        }
      } else if (k === "shareToken") {
        patch.shareToken = val === null || val === "" ? undefined : val;
      } else if (k === "groupId") {
        patch.groupId = val === null || val === "" ? undefined : val;
      } else if (k === "publicViewerSettings" && val && typeof val === "object") {
        const prev = build.publicViewerSettings ?? {};
        const incoming = val as Record<string, boolean | undefined>;
        const next: Record<string, boolean | undefined> = { ...prev };
        for (const key of [
          "showExplorer",
          "showTasks",
          "showVisualBoard",
          "showSummary",
          "showNotes",
          "showCollaborators",
        ]) {
          if (incoming[key] !== undefined) next[key] = incoming[key];
        }
        patch.publicViewerSettings = next;
      } else patch[k] = val;
    }
    if (Object.keys(patch).length > 0) {
      ctx.db.patch(build._id, withUpdateMeta(build, patch, ctx.now));
    }
    return ctx.db.get(build._id);
  },

  "builds:remove": (ctx, args) => {
    const build = getBuild(ctx, args.id);
    if (!build || build.userId !== ctx.userId) {
      throw new Error("Not found or not authorized");
    }
    deleteBuildCascade(ctx, build);
    return null;
  },

  "builds:removeMany": (ctx, args) => {
    for (const id of idList(args.ids)) {
      const build = getBuild(ctx, id);
      if (!build || build.userId !== ctx.userId) continue;
      deleteBuildCascade(ctx, build);
    }
    return null;
  },

  "builds:updateStatusMany": (ctx, args) => {
    const status = str(args.status);
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      throw new Error("Invalid status");
    }
    for (const id of idList(args.ids)) {
      const build = getBuild(ctx, id);
      if (!build || build.userId !== ctx.userId) continue;
      ctx.db.patch(build._id, withUpdateMeta(build, { status }, ctx.now));
    }
    return null;
  },

  "builds:linkNodes": (ctx, args) => {
    const build = getBuild(ctx, args.buildId);
    if (!build) throw new Error("Build not found");
    const validIds: string[] = [];
    for (const nodeId of Array.from(new Set(idList(args.cosplayNodeIds)))) {
      const node = getNode(ctx, nodeId);
      if (node && node.userId === ctx.userId) validIds.push(nodeId);
    }
    replaceBuildRootLinks(ctx, build._id, validIds);
    return null;
  },

  "builds:reorderRootLinks": (ctx, args) => {
    const build = getBuild(ctx, args.buildId);
    if (!build) throw new Error("Build not found");
    const roots = getBuildRootNodes(ctx, build._id);
    const nodeById = new Map(roots.map((node) => [node._id, node]));
    const orderedUnique = Array.from(new Set(idList(args.orderedCosplayNodeIds)));
    if (orderedUnique.length !== nodeById.size) {
      throw new Error("Ordered nodes must match existing root links");
    }
    for (const id of orderedUnique) {
      if (!nodeById.has(id)) throw new Error("Unknown cosplay node for this build");
    }
    orderedUnique.forEach((id, i) => {
      const node = nodeById.get(id);
      if (node) ctx.db.patch(node._id, withUpdateMeta(node, { sortOrder: i }, ctx.now));
    });
    return orderedUnique.length;
  },

  "builds:duplicate": (ctx, args) => {
    const source = getBuild(ctx, args.sourceBuildId);
    if (!source) throw new Error("Build not found");
    if (source.userId !== ctx.userId) {
      throw new Error("Only the outfit owner can duplicate it");
    }
    const actorId = ctx.userId;
    const dupName = sanitizeAndLimit(`${source.name} (copy)`, MAX_LENGTH.name, "Name");
    const newBuildId = ctx.db.insert(
      "builds",
      withCreateMeta(
        {
          userId: actorId,
          name: dupName,
          character: source.character,
          status: "idea",
          notes: source.notes,
          imageUrl: source.imageUrl,
          imageStorageId: source.imageStorageId,
          imageFocalX: source.imageFocalX,
          imageFocalY: source.imageFocalY,
          budgetCents: source.budgetCents,
          targetDate: source.targetDate,
          visibility: "private",
          manualProgressPercent: undefined,
          shareToken: undefined,
        },
        ctx.now
      )
    );

    const sourceNodes = ctx.db
      .query("cosplayNodes")
      .withIndex("by_buildId", (q) => q.eq("buildId", source._id))
      .collect() as NodeDoc[];
    const included = new Set(sourceNodes.map((node) => node._id));
    for (let i = 0; i < sourceNodes.length; i += 1) {
      const children = ctx.db
        .query("cosplayNodes")
        .withIndex("by_parentNodeId", (q) => q.eq("parentNodeId", sourceNodes[i]._id))
        .collect() as NodeDoc[];
      for (const child of children) {
        if (included.has(child._id)) continue;
        included.add(child._id);
        sourceNodes.push(child);
      }
    }
    const nodeIdMap = new Map<string, string>();
    for (const n of sourceNodes) {
      const newId = ctx.db.insert(
        "cosplayNodes",
        withCreateMeta(
          {
            userId: actorId,
            nodeType: n.nodeType,
            name: n.name,
            category: n.category,
            tags: n.tags,
            notes: n.notes,
            imageUrl: n.imageUrl,
            imageStorageId: n.imageStorageId,
            sourceUrl: n.sourceUrl,
            pricingMode: n.pricingMode,
            directCostCents: n.directCostCents,
            unitCostCents: n.unitCostCents,
            quantity: n.quantity,
            unit: n.unit,
            purchaseStatus: n.purchaseStatus,
            buildStatus: n.buildStatus,
            materialStatus: n.materialStatus,
            manualOverallBucket: n.manualOverallBucket,
            buildInstructions: n.buildInstructions,
            finishedPhotoUrls: n.finishedPhotoUrls,
            consumable: n.consumable,
            buildId: newBuildId,
            sortOrder: n.sortOrder,
          },
          ctx.now
        )
      );
      nodeIdMap.set(n._id, newId);
    }
    for (const n of sourceNodes) {
      if (n.parentNodeId === undefined) continue;
      const mappedParent = nodeIdMap.get(n.parentNodeId);
      const mappedSelf = nodeIdMap.get(n._id);
      if (mappedParent && mappedSelf) ctx.db.patch(mappedSelf, { parentNodeId: mappedParent });
    }

    for (const table of ["buildReferenceImages", "buildProcessPictures"] as const) {
      const rows = ctx.db
        .query(table)
        .withIndex("by_buildId", (q) => q.eq("buildId", source._id))
        .collect();
      for (const r of [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))) {
        ctx.db.insert(
          table,
          withCreateMeta(
            {
              userId: actorId,
              buildId: newBuildId,
              imageStorageId: r.imageStorageId,
              imageUrl: r.imageUrl,
              sortOrder: r.sortOrder,
            },
            ctx.now
          )
        );
      }
    }

    const scoped = getWorkflowItemsByAttachmentKey(
      ctx,
      actorId,
      [entityKey("build", source._id)],
      source._id
    );
    const items = scoped.items as VaultDoc[];
    const attachments = scoped.attachments as VaultDoc[];
    for (const item of items.filter((i) => i.kind === "task")) {
      if (item.parentId) continue;
      const itemAtts = attachments.filter((a) => a.workflowItemId === item._id);
      const buildPrimary = itemAtts.find(
        (a) => a.entityType === "build" && String(a.entityId) === source._id && a.role === "primary"
      );
      if (!buildPrimary) continue;
      const nodeAtt = itemAtts.find((a) => a.entityType === "cosplayNode");

      const newItemId = ctx.db.insert(
        "workflowItems",
        withCreateMeta(
          {
            userId: actorId,
            title: item.title,
            notes: item.notes,
            kind: "task",
            category: item.category,
            status: "not_started",
            parentId: undefined,
            ancestorIds: [],
            sortOrder: item.sortOrder,
            scopeKind: "build_specific",
            sourceKind: item.sourceKind,
            priority: item.priority,
            startDate: item.startDate,
            targetDate: item.targetDate,
            dueDate: item.dueDate,
            reminders: item.reminders,
            weight: item.weight,
            manualProgressPercent: undefined,
            estimatedMinutes: item.estimatedMinutes,
            actualMinutes: undefined,
            estimatedCostCents: item.estimatedCostCents,
            actualCostCents: undefined,
          },
          ctx.now
        )
      );
      ctx.db.insert(
        "workflowAttachments",
        withCreateMeta(
          {
            userId: actorId,
            workflowItemId: newItemId,
            entityType: "build",
            entityId: newBuildId,
            entityKey: entityKey("build", newBuildId),
            role: "primary",
          },
          ctx.now
        )
      );
      if (nodeAtt) {
        const mappedNodeId = nodeIdMap.get(String(nodeAtt.entityId)) ?? String(nodeAtt.entityId);
        ctx.db.insert(
          "workflowAttachments",
          withCreateMeta(
            {
              userId: actorId,
              workflowItemId: newItemId,
              entityType: "cosplayNode",
              entityId: mappedNodeId,
              entityKey: entityKey("cosplayNode", mappedNodeId),
              role: "progress_source",
              buildContextId: newBuildId,
            },
            ctx.now
          )
        );
      }
    }
    return newBuildId;
  },

  "builds:addNodesToBuild": (ctx, args) => {
    const build = getBuild(ctx, args.buildId);
    if (!build) throw new Error("Build not found");
    addBuildRootLinks(ctx, build._id, idList(args.cosplayNodeIds));
    return null;
  },

  "builds:removeNodeFromBuild": (ctx, args) => {
    removeBuildRootLink(ctx, args.buildId, args.cosplayNodeId);
    return null;
  },

  "builds:removeNodesFromBuild": (ctx, args) => {
    for (const nodeId of idList(args.cosplayNodeIds)) {
      removeBuildRootLink(ctx, args.buildId, nodeId);
    }
    return null;
  },
};
