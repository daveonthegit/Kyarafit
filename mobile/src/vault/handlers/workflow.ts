/**
 * Local port of the personal-data workflow functions in `convex/workflow.ts` (tasks, groups,
 * milestones, dependencies, and their build/node/planner projections).
 *
 * Differences from the server, by design of a single-owner on-device vault:
 * - no auth / collaborator / share-token checks (the vault owner may read and edit everything in
 *   it); existence checks are kept;
 * - `idempotencyKey` args are accepted and ignored (a local commit happens exactly once);
 * - built-in templates (`seedBuiltinTemplates` / `applyTemplate`) are not ported.
 */
import {
  deriveStatusProgress,
  isOverdueStatus,
  isWorkflowCategory,
  isWorkflowKind,
  isWorkflowScopeKind,
  isWorkflowSourceKind,
  isWorkflowStatus,
  WORKFLOW_ATTACHMENT_ROLES,
  WORKFLOW_DEPENDENCY_KINDS,
  WORKFLOW_ENTITY_TYPES,
  type WorkflowStatus,
} from "@kyarafit/design-system/domain/workflowProgress";
import type { VaultDoc } from "../store";
import type {
  LocalMutationCtx,
  LocalMutationHandler,
  LocalQueryCtx,
  LocalQueryHandler,
} from "../types";
import { withCreateMeta, withUpdateMeta } from "./lib/syncMeta";
import {
  MAX_LENGTH,
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeString,
  validateDateString,
} from "./lib/validation";
import {
  buildWorkflowTree,
  deriveDoneCounts,
  entityKey,
  flattenWorkflowTree,
  getWorkflowAttachmentsForUser,
  getWorkflowDependenciesForUser,
  getWorkflowItemsByAttachmentKey,
  getWorkflowItemsForUser,
  parentAncestorIds,
  type ReadCtx,
  type WorkflowAttachmentDoc,
  type WorkflowAttachmentInput,
  type WorkflowDependencyDoc,
  type WorkflowItemDoc,
} from "./lib/workflowDomain";

type MetaSource = { version?: number; fieldUpdatedAt?: Record<string, number> };

function meta(doc: VaultDoc | null | undefined): MetaSource {
  if (!doc) return {};
  return {
    version: typeof doc.version === "number" ? doc.version : undefined,
    fieldUpdatedAt:
      doc.fieldUpdatedAt && typeof doc.fieldUpdatedAt === "object"
        ? (doc.fieldUpdatedAt as Record<string, number>)
        : undefined,
  };
}

type AttachmentArg = {
  entityType: string;
  entityId: string;
  role?: string;
  buildContextId?: string;
  progressWeight?: number;
};

function coerceCategory(value: string | undefined | null) {
  return isWorkflowCategory(value) ? value : "craft";
}

function coerceKind(value: string | undefined | null) {
  return isWorkflowKind(value) ? value : "task";
}

function coerceStatus(value: string | undefined | null) {
  return isWorkflowStatus(value) ? value : "not_started";
}

function coerceScopeKind(value: string | undefined | null) {
  return isWorkflowScopeKind(value) ? value : "build_specific";
}

function coerceSourceKind(value: string | undefined | null) {
  return isWorkflowSourceKind(value) ? value : "manual";
}

function validateAttachment(input: AttachmentArg) {
  const entityType = WORKFLOW_ENTITY_TYPES.find((value) => value === input.entityType);
  if (!entityType) {
    throw new Error("Unsupported workflow attachment type");
  }
  const normalizedId = sanitizeString(input.entityId);
  const role =
    input.role &&
    WORKFLOW_ATTACHMENT_ROLES.includes(input.role as (typeof WORKFLOW_ATTACHMENT_ROLES)[number])
      ? input.role
      : "primary";
  return {
    entityType,
    entityId: normalizedId,
    entityKey: entityKey(entityType, normalizedId),
    role,
    buildContextId: input.buildContextId,
    progressWeight: input.progressWeight,
  };
}

function sanitizeReminders(reminders: { kind: string; date: string }[] | undefined) {
  if (!reminders) return undefined;
  return reminders.map((reminder, index) => ({
    kind: sanitizeAndLimit(reminder.kind, MAX_LENGTH.category, `Reminder ${index + 1} kind`),
    date: validateDateString(reminder.date, `Reminder ${index + 1} date`),
  }));
}

function sanitizeWorkflowInput(input: {
  title?: string;
  notes?: string;
  kind?: string;
  category?: string;
  status?: string;
  scopeKind?: string;
  sourceKind?: string;
  startDate?: string;
  targetDate?: string;
  dueDate?: string;
  reminders?: { kind: string; date: string }[];
  recurrenceRule?: string;
  dedupeKey?: string;
}) {
  return {
    ...(input.title !== undefined && {
      title: sanitizeAndLimit(input.title, MAX_LENGTH.label, "Workflow title"),
    }),
    ...(input.notes !== undefined && {
      notes: sanitizeOptional(input.notes, MAX_LENGTH.notes, "Workflow notes"),
    }),
    ...(input.kind !== undefined && { kind: coerceKind(input.kind) }),
    ...(input.category !== undefined && { category: coerceCategory(input.category) }),
    ...(input.status !== undefined && { status: coerceStatus(input.status) }),
    ...(input.scopeKind !== undefined && { scopeKind: coerceScopeKind(input.scopeKind) }),
    ...(input.sourceKind !== undefined && { sourceKind: coerceSourceKind(input.sourceKind) }),
    ...(input.startDate !== undefined && {
      startDate: input.startDate ? validateDateString(input.startDate, "Start date") : undefined,
    }),
    ...(input.targetDate !== undefined && {
      targetDate: input.targetDate
        ? validateDateString(input.targetDate, "Target date")
        : undefined,
    }),
    ...(input.dueDate !== undefined && {
      dueDate: input.dueDate ? validateDateString(input.dueDate, "Due date") : undefined,
    }),
    ...(input.reminders !== undefined && { reminders: sanitizeReminders(input.reminders) }),
    ...(input.recurrenceRule !== undefined && {
      recurrenceRule: sanitizeOptional(input.recurrenceRule, 500, "Recurrence rule"),
    }),
    ...(input.dedupeKey !== undefined && {
      dedupeKey: sanitizeOptional(input.dedupeKey, 500, "Dedupe key"),
    }),
  };
}

function replaceAttachments(
  ctx: LocalMutationCtx,
  userId: string,
  workflowItemId: string,
  attachments: AttachmentArg[]
) {
  const existing = ctx.db
    .query("workflowAttachments")
    .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", workflowItemId))
    .collect();
  for (const row of existing) ctx.db.delete(row._id);
  for (const attachment of attachments) {
    const normalized = validateAttachment(attachment);
    ctx.db.insert(
      "workflowAttachments",
      withCreateMeta(
        {
          userId,
          workflowItemId,
          ...normalized,
        },
        ctx.now
      )
    );
  }
}

function getSiblingCount(ctx: ReadCtx, userId: string, parentId: string | undefined) {
  const items = getWorkflowItemsForUser(ctx, userId);
  return items.filter((item) => item.parentId === parentId).length;
}

function patchDescendantAncestors(
  ctx: LocalMutationCtx,
  userId: string,
  rootId: string,
  newAncestorIds: string[]
) {
  const items = getWorkflowItemsForUser(ctx, userId);
  const descendants = items
    .filter((item) => item.ancestorIds.includes(rootId))
    .sort((a, b) => a.ancestorIds.length - b.ancestorIds.length);

  for (const descendant of descendants) {
    const movedIndex = descendant.ancestorIds.indexOf(rootId);
    const tail = descendant.ancestorIds.slice(movedIndex);
    ctx.db.patch(
      descendant._id,
      withUpdateMeta(descendant, { ancestorIds: [...newAncestorIds, ...tail] }, ctx.now)
    );
  }
}

function buildExternalProgress(ctx: ReadCtx, userId: string, items: WorkflowItemDoc[]) {
  const attachments = getWorkflowAttachmentsForUser(ctx, userId);
  const itemIdSet = new Set(items.map((item) => item._id));
  const map = new Map<
    string,
    { progressPercent?: number; weight?: number; excluded?: boolean }[]
  >();
  for (const attachment of attachments) {
    if (!itemIdSet.has(attachment.workflowItemId)) continue;
    if (attachment.role !== "progress_source" && attachment.role !== "completion_anchor") continue;
    let progressPercent: number | undefined;
    if (attachment.entityType === "packingItem") {
      const packingItem = ctx.db.get(attachment.entityId);
      progressPercent = packingItem?.checked ? 100 : 0;
    } else if (attachment.entityType === "cosplayNode") {
      const node = ctx.db.get(attachment.entityId);
      if (node) {
        progressPercent = deriveStatusProgress({
          status:
            node.materialStatus === "complete" || node.buildStatus === "built"
              ? "done"
              : node.materialStatus === "in_use" || node.buildStatus === "wip"
                ? "in_progress"
                : node.purchaseStatus === "bought"
                  ? "scheduled"
                  : "not_started",
        });
      }
    }
    if (progressPercent == null) continue;
    const list = map.get(attachment.workflowItemId) ?? [];
    list.push({ progressPercent, weight: attachment.progressWeight });
    map.set(attachment.workflowItemId, list);
  }
  return map;
}

function buildResolvedWorkflowTree(
  ctx: ReadCtx,
  userId: string,
  items: WorkflowItemDoc[],
  attachments: WorkflowAttachmentDoc[]
) {
  const externalProgress = buildExternalProgress(ctx, userId, items);
  const dependencies = getWorkflowDependenciesForUser(ctx, userId);
  return buildWorkflowTree({
    items,
    attachments,
    dependencies: dependencies.filter(
      (dependency) =>
        items.some((item) => item._id === dependency.predecessorWorkflowItemId) ||
        items.some((item) => item._id === dependency.successorWorkflowItemId)
    ),
    externalProgress,
  });
}

/** The build's workflow tree: items attached to the build or to its root elements. */
export function getBuildScopedWorkflow(ctx: ReadCtx, buildId: string) {
  const build = ctx.db.get(buildId);
  if (!build) return null;
  const buildUserId = String(build.userId ?? "");
  // Step 2c: the build's root nodes are its own cosplayNodes with no parent, sourced from `buildId`.
  const buildNodes = ctx.db
    .query("cosplayNodes")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  const rootNodes = buildNodes.filter((node) => node.parentNodeId === undefined);
  const keys = [
    entityKey("build", buildId),
    ...rootNodes.map((node) => entityKey("cosplayNode", node._id)),
  ];
  const scoped = getWorkflowItemsByAttachmentKey(ctx, buildUserId, keys, buildId);
  const tree = buildResolvedWorkflowTree(ctx, buildUserId, scoped.items, scoped.attachments);
  return { build, tree, items: flattenWorkflowTree(tree) };
}

function ensureWorkflowItem(
  ctx: LocalMutationCtx,
  input: {
    userId: string;
    dedupeKey: string;
    title: string;
    notes?: string;
    category: string;
    status?: string;
    attachments: AttachmentArg[];
    scopeKind?: string;
    sourceKind?: string;
    dueDate?: string;
  }
): string {
  const existing = ctx.db
    .query("workflowItems")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", input.dedupeKey))
    .first() as WorkflowItemDoc | null;

  const normalizedStatus = coerceStatus(input.status);
  if (existing) {
    ctx.db.patch(
      existing._id,
      withUpdateMeta(
        existing,
        {
          title: input.title,
          notes: sanitizeOptional(input.notes, MAX_LENGTH.notes, "Workflow notes"),
          category: coerceCategory(input.category),
          status: normalizedStatus,
          dueDate: input.dueDate,
          scopeKind: coerceScopeKind(input.scopeKind),
          sourceKind: coerceSourceKind(input.sourceKind),
        },
        ctx.now
      )
    );
    replaceAttachments(ctx, input.userId, existing._id, input.attachments);
    return existing._id;
  }

  const id = ctx.db.insert(
    "workflowItems",
    withCreateMeta(
      {
        userId: input.userId,
        title: sanitizeAndLimit(input.title, MAX_LENGTH.label, "Workflow title"),
        notes: sanitizeOptional(input.notes, MAX_LENGTH.notes, "Workflow notes"),
        kind: "task",
        category: coerceCategory(input.category),
        status: normalizedStatus,
        ancestorIds: [],
        sortOrder: 0,
        scopeKind: coerceScopeKind(input.scopeKind),
        sourceKind: coerceSourceKind(input.sourceKind),
        dueDate: input.dueDate,
        dedupeKey: input.dedupeKey,
      },
      ctx.now
    )
  );
  replaceAttachments(ctx, input.userId, id, input.attachments);
  return id;
}

/** Auto-generated "Buy X" / "Work on X" tasks that follow an element's statuses. */
export function syncGeneratedWorkflowForNode(
  ctx: LocalMutationCtx,
  input: {
    userId: string;
    cosplayNodeId: string;
    buildId?: string;
    nodeName: string;
    category?: string | null;
    purchaseStatus?: string | null;
    buildStatus?: string | null;
    materialStatus?: string | null;
  }
): void {
  const attachments: WorkflowAttachmentInput[] = [
    {
      entityType: "cosplayNode",
      entityId: input.cosplayNodeId,
      role: "progress_source" as const,
      buildContextId: input.buildId,
    },
    ...(input.buildId
      ? [
          {
            entityType: "build" as const,
            entityId: input.buildId,
            role: "context" as const,
            buildContextId: input.buildId,
          },
        ]
      : []),
  ];

  const wig = input.category?.toLowerCase().includes("wig");
  const specs = [
    {
      key: "buy",
      active: input.purchaseStatus === "to_buy" || input.materialStatus === "to_buy",
      done:
        input.purchaseStatus === "bought" ||
        ["bought", "in_use", "complete"].includes(input.materialStatus ?? ""),
      title: `Buy ${input.nodeName}`,
      category: "buy",
      status: "not_started",
    },
    {
      key: "wip",
      active: input.buildStatus === "wip" || input.materialStatus === "in_use",
      done: input.buildStatus === "built" || input.materialStatus === "complete",
      title: `${wig ? "Style" : "Work on"} ${input.nodeName}`,
      category: wig ? "style" : "craft",
      status: "in_progress",
    },
  ];
  for (const spec of specs) {
    const dedupeKey = `autogen:${spec.key}:${input.buildId ?? "shared"}:${input.cosplayNodeId}`;
    const existing = ctx.db
      .query("workflowItems")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .first();
    if (spec.active || (spec.done && existing)) {
      ensureWorkflowItem(ctx, {
        userId: input.userId,
        dedupeKey,
        title: spec.title,
        category: spec.category,
        status: spec.active ? spec.status : "done",
        scopeKind: input.buildId ? "build_specific" : "shared",
        sourceKind: "automation",
        attachments,
      });
    } else if (existing) {
      removeWorkflowItemCascade(ctx, existing._id);
    }
  }
}

export function removeGeneratedWorkflowForNode(ctx: LocalMutationCtx, cosplayNodeId: string): void {
  const items = ctx.db
    .query("workflowItems")
    .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
    .collect();
  for (const item of items) {
    if (
      item.sourceKind === "automation" &&
      typeof item.dedupeKey === "string" &&
      (item.dedupeKey.startsWith("autogen:buy:") || item.dedupeKey.startsWith("autogen:wip:")) &&
      item.dedupeKey.endsWith(`:${cosplayNodeId}`)
    ) {
      removeWorkflowItemCascade(ctx, item._id);
    }
  }
}

/** Mirror a packing-list entry as a "pack" workflow task (and link the packing row back to it). */
export function ensurePackingWorkflowItem(
  ctx: LocalMutationCtx,
  input: {
    userId: string;
    packingListItemId: string;
    conventionId: string;
    buildId?: string;
    cosplayNodeId?: string;
    label: string;
    notes?: string;
    dueDate?: string;
    checked: boolean;
    manual: boolean;
  }
): string {
  const dedupeKey = `packing:${input.packingListItemId}`;
  const attachments: WorkflowAttachmentInput[] = [
    {
      entityType: "packingItem",
      entityId: input.packingListItemId,
      role: "packing_entry" as const,
    },
    { entityType: "convention", entityId: input.conventionId, role: "context" as const },
    ...(input.buildId
      ? [
          {
            entityType: "build" as const,
            entityId: input.buildId,
            role: "context" as const,
            buildContextId: input.buildId,
          },
        ]
      : []),
    ...(input.cosplayNodeId
      ? [
          {
            entityType: "cosplayNode" as const,
            entityId: input.cosplayNodeId,
            role: "progress_source" as const,
            buildContextId: input.buildId,
          },
        ]
      : []),
  ];

  const workflowItemId = ensureWorkflowItem(ctx, {
    userId: input.userId,
    dedupeKey,
    title: input.label,
    notes: input.notes,
    category: "pack",
    status: input.checked ? "done" : "not_started",
    scopeKind: input.buildId ? "build_specific" : "shared",
    sourceKind: "packing",
    dueDate: input.dueDate,
    attachments,
  });
  const packingItem = ctx.db.get(input.packingListItemId);
  ctx.db.patch(
    input.packingListItemId,
    withUpdateMeta(
      meta(packingItem),
      {
        workflowItemId,
        entryKind: input.manual ? "manual" : "generated",
        sourceKind: input.manual ? "manual" : "workflow",
      },
      ctx.now
    )
  );
  return workflowItemId;
}

function syncPackingItemsFromWorkflowItem(ctx: LocalMutationCtx, workflowItem: WorkflowItemDoc) {
  const attachments = ctx.db
    .query("workflowAttachments")
    .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", workflowItem._id))
    .collect() as WorkflowAttachmentDoc[];

  for (const attachment of attachments) {
    if (attachment.entityType !== "packingItem") continue;
    const packingId = attachment.entityId;
    const packingItem = ctx.db.get(packingId);
    // The server's patch throws on a dangling packing reference; locally skip it instead of
    // failing the user's workflow edit over a stale attachment.
    if (!packingItem) continue;
    ctx.db.patch(
      packingId,
      withUpdateMeta(
        meta(packingItem),
        {
          workflowItemId: workflowItem._id,
          label: workflowItem.title,
          notes: workflowItem.notes,
          date: workflowItem.dueDate,
          checked: workflowItem.status === "done",
        },
        ctx.now
      )
    );
  }
}

/** Delete a workflow item, its whole subtree, their attachments (and packed rows) and deps. */
export function removeWorkflowItemCascade(ctx: LocalMutationCtx, workflowItemId: string): void {
  const item = ctx.db.get(workflowItemId) as WorkflowItemDoc | null;
  if (!item) return;

  const userItems = getWorkflowItemsForUser(ctx, item.userId);
  const subtreeIds = userItems
    .filter(
      (candidate) =>
        candidate._id === workflowItemId || candidate.ancestorIds.includes(workflowItemId)
    )
    .map((candidate) => candidate._id);
  const idSet = new Set(subtreeIds);

  const attachments = getWorkflowAttachmentsForUser(ctx, item.userId);
  for (const attachment of attachments) {
    if (!idSet.has(attachment.workflowItemId)) continue;
    if (attachment.entityType === "packingItem" && ctx.db.get(attachment.entityId)) {
      ctx.db.delete(attachment.entityId);
    }
    ctx.db.delete(attachment._id);
  }

  const dependencies = getWorkflowDependenciesForUser(ctx, item.userId);
  for (const dependency of dependencies) {
    if (
      idSet.has(dependency.predecessorWorkflowItemId) ||
      idSet.has(dependency.successorWorkflowItemId)
    ) {
      ctx.db.delete(dependency._id);
    }
  }

  for (const id of subtreeIds.reverse()) {
    if (ctx.db.get(id)) ctx.db.delete(id);
  }
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

function listBuildTree(ctx: LocalQueryCtx, args: Record<string, unknown>) {
  const buildId = args.buildId as string;
  const build = ctx.db.get(buildId);
  if (!build) return null;
  const scoped = getBuildScopedWorkflow(ctx, buildId);
  if (!scoped) return null;
  const { total, done } = deriveDoneCounts(scoped.items);
  const workflowProgressPercent =
    total > 0
      ? Math.round((done / total) * 100)
      : scoped.items.length > 0
        ? Math.round(
            scoped.items.reduce(
              (sum, item) =>
                sum +
                deriveStatusProgress({
                  status: item.status as WorkflowStatus,
                  manualProgressPercent: item.manualProgressPercent,
                }),
              0
            ) / scoped.items.length
          )
        : 0;
  return {
    buildId,
    items: scoped.tree,
    stats: {
      tasksTotal: total,
      tasksDone: done,
      workflowProgressPercent,
    },
  };
}

function listNodeWorkflow(ctx: LocalQueryCtx, args: Record<string, unknown>) {
  const cosplayNodeId = args.cosplayNodeId as string;
  const buildId = (args.buildId as string | undefined) ?? undefined;
  const node = ctx.db.get(cosplayNodeId);
  if (!node) return null;
  const nodeUserId = String(node.userId ?? ctx.userId);

  const sharedScoped = getWorkflowItemsByAttachmentKey(ctx, nodeUserId, [
    entityKey("cosplayNode", cosplayNodeId),
  ]);
  const sharedTree = buildResolvedWorkflowTree(
    ctx,
    nodeUserId,
    sharedScoped.items.filter((item) => item.scopeKind === "shared"),
    sharedScoped.attachments
  );

  if (!buildId) {
    return { shared: sharedTree, buildSpecific: [] };
  }

  const buildScoped = getWorkflowItemsByAttachmentKey(
    ctx,
    nodeUserId,
    [entityKey("cosplayNode", cosplayNodeId), entityKey("build", buildId)],
    buildId
  );
  const buildSpecificTree = buildResolvedWorkflowTree(
    ctx,
    nodeUserId,
    buildScoped.items.filter((item) => item.scopeKind === "build_specific"),
    buildScoped.attachments
  );
  return { shared: sharedTree, buildSpecific: buildSpecificTree };
}

function listPlanner(ctx: LocalQueryCtx) {
  const actorId = ctx.userId;
  const items = getWorkflowItemsForUser(ctx, actorId);
  const attachments = getWorkflowAttachmentsForUser(ctx, actorId);
  const buildById = new Map<string, VaultDoc>();
  const conventionById = new Map<string, VaultDoc>();
  for (const attachment of attachments) {
    if (attachment.entityType === "build" && !buildById.has(attachment.entityId)) {
      const build = ctx.db.get(attachment.entityId);
      if (build) buildById.set(attachment.entityId, build);
    }
    if (attachment.entityType === "convention" && !conventionById.has(attachment.entityId)) {
      const convention = ctx.db.get(attachment.entityId);
      if (convention) conventionById.set(attachment.entityId, convention);
    }
  }

  const dependencies = getWorkflowDependenciesForUser(ctx, actorId);
  const itemMap = new Map(items.map((item) => [item._id, item]));
  const blockedByMap = new Map<string, number>();
  const blockedByTitlesMap = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const predecessor = itemMap.get(dependency.predecessorWorkflowItemId);
    if (!predecessor || predecessor.status === "done") continue;
    blockedByMap.set(
      dependency.successorWorkflowItemId,
      (blockedByMap.get(dependency.successorWorkflowItemId) ?? 0) + 1
    );
    const preview = blockedByTitlesMap.get(dependency.successorWorkflowItemId) ?? [];
    if (!preview.includes(predecessor.title)) {
      preview.push(predecessor.title);
    }
    blockedByTitlesMap.set(dependency.successorWorkflowItemId, preview);
  }

  const today = new Date(ctx.now).toISOString().slice(0, 10);
  const nameOf = (doc: VaultDoc | undefined) => (typeof doc?.name === "string" ? doc.name : null);
  return items
    .filter((item) => item.kind !== "group")
    .map((item) => {
      const itemAttachments = attachments.filter(
        (attachment) => attachment.workflowItemId === item._id
      );
      const buildAttachment = itemAttachments.find(
        (attachment) => attachment.entityType === "build"
      );
      const conventionAttachment = itemAttachments.find(
        (attachment) => attachment.entityType === "convention"
      );
      const nodeAttachment = itemAttachments.find(
        (attachment) => attachment.entityType === "cosplayNode"
      );
      const packingAttachment = itemAttachments.find(
        (attachment) => attachment.entityType === "packingItem"
      );
      return {
        _id: item._id,
        title: item.title,
        kind: item.kind,
        category: item.category,
        status: item.status,
        parentId: item.parentId,
        ancestorIds: item.ancestorIds,
        sortOrder: item.sortOrder,
        priority: item.priority ?? 0,
        dueDate: item.dueDate,
        targetDate: item.targetDate,
        startDate: item.startDate,
        progressPercent: deriveStatusProgress({
          status: item.status as WorkflowStatus,
          manualProgressPercent: item.manualProgressPercent,
        }),
        overdue: isOverdueStatus({
          dueDate: item.dueDate,
          status: item.status as WorkflowStatus,
          today,
        }),
        blockedByCount: blockedByMap.get(item._id) ?? 0,
        blockedByTitles: blockedByTitlesMap.get(item._id) ?? [],
        buildId: buildAttachment?.entityId,
        buildName: buildAttachment ? nameOf(buildById.get(buildAttachment.entityId)) : null,
        conventionId: conventionAttachment?.entityId,
        conventionName: conventionAttachment
          ? nameOf(conventionById.get(conventionAttachment.entityId))
          : null,
        cosplayNodeId: nodeAttachment?.entityId,
        packingListItemId: packingAttachment?.entityId,
      };
    })
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if ((a.dueDate ?? "9999-12-31") !== (b.dueDate ?? "9999-12-31")) {
        return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
      }
      if (a.blockedByCount !== b.blockedByCount) return a.blockedByCount - b.blockedByCount;
      return a.title.localeCompare(b.title);
    });
}

function getItemEditorState(ctx: LocalQueryCtx, args: Record<string, unknown>) {
  const id = args.id as string;
  const item = ctx.db.get(id) as WorkflowItemDoc | null;
  if (!item) return null;

  const dependencies = ctx.db
    .query("workflowDependencies")
    .withIndex("by_successorWorkflowItemId", (q) => q.eq("successorWorkflowItemId", id))
    .collect() as WorkflowDependencyDoc[];

  return {
    _id: item._id,
    title: item.title,
    notes: item.notes ?? "",
    status: item.status,
    kind: item.kind,
    category: item.category,
    dueDate: item.dueDate ?? "",
    predecessorIds: dependencies.map((dependency) => dependency.predecessorWorkflowItemId),
  };
}

// ---------------------------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------------------------

type CreateArgs = {
  title: string;
  notes?: string;
  kind?: string;
  category?: string;
  status?: string;
  parentId?: string;
  sortOrder?: number;
  scopeKind?: string;
  sourceKind?: string;
  priority?: number;
  startDate?: string;
  targetDate?: string;
  dueDate?: string;
  reminders?: { kind: string; date: string }[];
  weight?: number;
  manualProgressPercent?: number;
  estimatedMinutes?: number;
  actualMinutes?: number;
  estimatedCostCents?: number;
  actualCostCents?: number;
  ownerUserId?: string;
  assigneeUserId?: string;
  templateId?: string;
  recurrenceRule?: string;
  legacyBuildTaskId?: string;
  dedupeKey?: string;
  attachments?: AttachmentArg[];
};

function create(ctx: LocalMutationCtx, rawArgs: Record<string, unknown>) {
  const args = rawArgs as unknown as CreateArgs;
  const actorId = ctx.userId;
  const parent = args.parentId ? (ctx.db.get(args.parentId) as WorkflowItemDoc | null) : null;

  const sanitized = sanitizeWorkflowInput(args);
  const workflowItemId = ctx.db.insert(
    "workflowItems",
    withCreateMeta(
      {
        userId: actorId,
        title: sanitized.title ?? "",
        notes: sanitized.notes,
        kind: sanitized.kind ?? "task",
        category: sanitized.category ?? "craft",
        status: sanitized.status ?? "not_started",
        parentId: args.parentId,
        ancestorIds: parentAncestorIds(parent),
        sortOrder: args.sortOrder ?? getSiblingCount(ctx, actorId, args.parentId),
        scopeKind: sanitized.scopeKind ?? "build_specific",
        sourceKind: sanitized.sourceKind ?? "manual",
        priority: args.priority,
        startDate: sanitized.startDate,
        targetDate: sanitized.targetDate,
        dueDate: sanitized.dueDate,
        reminders: sanitized.reminders,
        weight: args.weight,
        manualProgressPercent: args.manualProgressPercent,
        estimatedMinutes: args.estimatedMinutes,
        actualMinutes: args.actualMinutes,
        estimatedCostCents: args.estimatedCostCents,
        actualCostCents: args.actualCostCents,
        creatorUserId: actorId,
        ownerUserId: args.ownerUserId ?? actorId,
        assigneeUserId: args.assigneeUserId,
        templateId: args.templateId,
        recurrenceRule: sanitized.recurrenceRule,
        legacyBuildTaskId: args.legacyBuildTaskId,
        dedupeKey: sanitized.dedupeKey,
      },
      ctx.now
    )
  );
  if (args.attachments?.length) {
    replaceAttachments(ctx, actorId, workflowItemId, args.attachments);
  }
  return ctx.db.get(workflowItemId);
}

type Nullable<T> = T | null | undefined;

type UpdateArgs = {
  id: string;
  title?: string;
  notes?: Nullable<string>;
  kind?: string;
  category?: string;
  status?: string;
  sortOrder?: number;
  scopeKind?: string;
  sourceKind?: string;
  priority?: Nullable<number>;
  startDate?: Nullable<string>;
  targetDate?: Nullable<string>;
  dueDate?: Nullable<string>;
  reminders?: Nullable<{ kind: string; date: string }[]>;
  weight?: Nullable<number>;
  manualProgressPercent?: Nullable<number>;
  estimatedMinutes?: Nullable<number>;
  actualMinutes?: Nullable<number>;
  estimatedCostCents?: Nullable<number>;
  actualCostCents?: Nullable<number>;
  ownerUserId?: Nullable<string>;
  assigneeUserId?: Nullable<string>;
  recurrenceRule?: Nullable<string>;
  attachments?: AttachmentArg[];
};

function update(ctx: LocalMutationCtx, rawArgs: Record<string, unknown>) {
  const args = rawArgs as unknown as UpdateArgs;
  const item = ctx.db.get(args.id) as WorkflowItemDoc | null;
  if (!item) throw new Error("Workflow item not found");
  const sanitized = sanitizeWorkflowInput({
    title: args.title,
    notes: args.notes === null ? undefined : args.notes,
    kind: args.kind,
    category: args.category,
    status: args.status,
    scopeKind: args.scopeKind,
    sourceKind: args.sourceKind,
    startDate: args.startDate === null ? undefined : args.startDate,
    targetDate: args.targetDate === null ? undefined : args.targetDate,
    dueDate: args.dueDate === null ? undefined : args.dueDate,
    reminders: args.reminders === null ? undefined : args.reminders,
    recurrenceRule: args.recurrenceRule === null ? undefined : args.recurrenceRule,
  });

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sanitized)) patch[key] = value;
  for (const key of [
    "notes",
    "startDate",
    "targetDate",
    "dueDate",
    "reminders",
    "recurrenceRule",
  ] as const) {
    if (args[key] === null) patch[key] = undefined;
  }
  if (args.sortOrder !== undefined) patch.sortOrder = args.sortOrder;
  if (args.priority !== undefined)
    patch.priority = args.priority === null ? undefined : args.priority;
  if (args.weight !== undefined) patch.weight = args.weight === null ? undefined : args.weight;
  if (args.manualProgressPercent !== undefined) {
    patch.manualProgressPercent =
      args.manualProgressPercent === null
        ? undefined
        : Math.max(0, Math.min(100, Math.round(args.manualProgressPercent)));
  }
  if (args.estimatedMinutes !== undefined) {
    patch.estimatedMinutes = args.estimatedMinutes === null ? undefined : args.estimatedMinutes;
  }
  if (args.actualMinutes !== undefined) {
    patch.actualMinutes = args.actualMinutes === null ? undefined : args.actualMinutes;
  }
  if (args.estimatedCostCents !== undefined) {
    patch.estimatedCostCents =
      args.estimatedCostCents === null ? undefined : args.estimatedCostCents;
  }
  if (args.actualCostCents !== undefined) {
    patch.actualCostCents = args.actualCostCents === null ? undefined : args.actualCostCents;
  }
  if (args.ownerUserId !== undefined) {
    patch.ownerUserId = args.ownerUserId === null ? undefined : args.ownerUserId;
  }
  if (args.assigneeUserId !== undefined) {
    patch.assigneeUserId = args.assigneeUserId === null ? undefined : args.assigneeUserId;
  }
  ctx.db.patch(args.id, withUpdateMeta(item, patch, ctx.now));
  if (args.attachments) {
    replaceAttachments(ctx, item.userId, args.id, args.attachments);
  }
  const updated = ctx.db.get(args.id) as WorkflowItemDoc | null;
  if (updated) {
    syncPackingItemsFromWorkflowItem(ctx, updated);
  }
  return updated;
}

type MoveArgs = { id: string; parentId?: string | null; sortOrder?: number };

function applyMove(ctx: LocalMutationCtx, move: MoveArgs) {
  const item = ctx.db.get(move.id) as WorkflowItemDoc | null;
  if (!item) throw new Error("Workflow item not found");

  const parentId = move.parentId ?? undefined;
  if (parentId && parentId === move.id) {
    throw new Error("Workflow items cannot parent themselves");
  }
  const parent = parentId ? (ctx.db.get(parentId) as WorkflowItemDoc | null) : null;
  if (parentId && !parent) throw new Error("Parent not found");
  if (parent?.ancestorIds.includes(move.id)) {
    throw new Error("Workflow items cannot move under a descendant");
  }
  return { item, parentId, parent };
}

function move(ctx: LocalMutationCtx, rawArgs: Record<string, unknown>) {
  const args = rawArgs as unknown as MoveArgs;
  const { item, parentId, parent } = applyMove(ctx, args);
  const ancestorIds = parentAncestorIds(parent);
  ctx.db.patch(
    args.id,
    withUpdateMeta(
      item,
      { parentId, ancestorIds, sortOrder: args.sortOrder ?? item.sortOrder },
      ctx.now
    )
  );
  patchDescendantAncestors(ctx, item.userId, args.id, ancestorIds);
  return ctx.db.get(args.id);
}

function moveAndResequence(ctx: LocalMutationCtx, rawArgs: Record<string, unknown>) {
  const args = rawArgs as unknown as {
    move: MoveArgs;
    resequence: { id: string; sortOrder: number }[];
  };
  const { item, parentId, parent } = applyMove(ctx, args.move);

  const resequenceItems = new Map<string, WorkflowItemDoc>();
  for (const row of args.resequence) {
    if (resequenceItems.has(row.id)) continue;
    const rowItem = row.id === item._id ? item : (ctx.db.get(row.id) as WorkflowItemDoc | null);
    if (!rowItem) throw new Error("Workflow item not found");
    resequenceItems.set(row.id, rowItem);
  }

  const ancestorIds = parentAncestorIds(parent);
  ctx.db.patch(
    args.move.id,
    withUpdateMeta(
      item,
      { parentId, ancestorIds, sortOrder: args.move.sortOrder ?? item.sortOrder },
      ctx.now
    )
  );
  patchDescendantAncestors(ctx, item.userId, args.move.id, ancestorIds);

  for (const row of args.resequence) {
    const rowItem = resequenceItems.get(row.id);
    if (!rowItem) continue;
    const movedRowAlreadyPatched =
      row.id === args.move.id && row.sortOrder === (args.move.sortOrder ?? item.sortOrder);
    if (movedRowAlreadyPatched || rowItem.sortOrder === row.sortOrder) continue;
    // Re-read: the moved row (or a descendant) may already carry staged changes from above.
    const current = (ctx.db.get(row.id) as WorkflowItemDoc | null) ?? rowItem;
    ctx.db.patch(row.id, withUpdateMeta(current, { sortOrder: row.sortOrder }, ctx.now));
  }

  return ctx.db.get(args.move.id);
}

function setDependencies(ctx: LocalMutationCtx, rawArgs: Record<string, unknown>) {
  const args = rawArgs as unknown as {
    workflowItemId: string;
    dependencies: { predecessorWorkflowItemId: string; relationKind: string }[];
  };
  const item = ctx.db.get(args.workflowItemId) as WorkflowItemDoc | null;
  if (!item) throw new Error("Workflow item not found");
  const existing = ctx.db
    .query("workflowDependencies")
    .withIndex("by_successorWorkflowItemId", (q) =>
      q.eq("successorWorkflowItemId", args.workflowItemId)
    )
    .collect();
  for (const dependency of existing) ctx.db.delete(dependency._id);
  for (const dependency of args.dependencies) {
    if (
      !WORKFLOW_DEPENDENCY_KINDS.includes(
        dependency.relationKind as (typeof WORKFLOW_DEPENDENCY_KINDS)[number]
      )
    ) {
      throw new Error("Unsupported dependency kind");
    }
    if (dependency.predecessorWorkflowItemId === args.workflowItemId) {
      throw new Error("Workflow item cannot depend on itself");
    }
    ctx.db.insert(
      "workflowDependencies",
      withCreateMeta(
        {
          userId: item.userId,
          predecessorWorkflowItemId: dependency.predecessorWorkflowItemId,
          successorWorkflowItemId: args.workflowItemId,
          relationKind: dependency.relationKind,
        },
        ctx.now
      )
    );
  }
  return ctx.db
    .query("workflowDependencies")
    .withIndex("by_successorWorkflowItemId", (q) =>
      q.eq("successorWorkflowItemId", args.workflowItemId)
    )
    .collect();
}

function remove(ctx: LocalMutationCtx, args: Record<string, unknown>) {
  const id = args.id as string;
  const item = ctx.db.get(id);
  if (!item) throw new Error("Workflow item not found");
  removeWorkflowItemCascade(ctx, id);
  return null;
}

export const queries: Record<string, LocalQueryHandler> = {
  "workflow:listBuildTree": listBuildTree,
  "workflow:listNodeWorkflow": listNodeWorkflow,
  "workflow:listPlanner": listPlanner,
  "workflow:getItemEditorState": getItemEditorState,
};

export const mutations: Record<string, LocalMutationHandler> = {
  "workflow:create": create,
  "workflow:update": update,
  "workflow:move": move,
  "workflow:moveAndResequence": moveAndResequence,
  "workflow:setDependencies": setDependencies,
  "workflow:remove": remove,
};
