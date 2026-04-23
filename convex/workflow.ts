import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { canUserEditBuild } from "./lib/buildAccess";
import { canReadBuildWorkflowData } from "./lib/buildPublicViewer";
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
  type WorkflowAttachmentInput,
  type WorkflowItemDoc,
} from "./lib/workflowDomain";
import {
  deriveBuildBlendedProgress,
  deriveStatusProgress,
  isDoneStatus,
  isOverdueStatus,
  isWorkflowCategory,
  isWorkflowKind,
  isWorkflowScopeKind,
  isWorkflowSourceKind,
  isWorkflowStatus,
  WORKFLOW_ATTACHMENT_ROLES,
  WORKFLOW_CATEGORIES,
  WORKFLOW_DEPENDENCY_KINDS,
  WORKFLOW_ENTITY_TYPES,
  WORKFLOW_ITEM_KINDS,
  WORKFLOW_SCOPE_KINDS,
  WORKFLOW_SOURCE_KINDS,
  WORKFLOW_STATUSES,
} from "./lib/workflowProgress";
import {
  sanitizeAndLimit,
  sanitizeOptional,
  sanitizeString,
  validateDateString,
  MAX_LENGTH,
} from "./lib/validation";

const reminderValidator = v.object({
  kind: v.string(),
  date: v.string(),
});

const attachmentValidator = v.object({
  entityType: v.string(),
  entityId: v.string(),
  role: v.optional(v.string()),
  buildContextId: v.optional(v.id("builds")),
  progressWeight: v.optional(v.number()),
});

const builtinTemplates = [
  {
    slug: "wig-styling",
    name: "Style Wig",
    description: "A reusable styling sequence for wigs.",
    category: "style",
    items: [
      {
        key: "root",
        title: "Wig Styling",
        kind: "group",
        category: "style",
        status: "not_started",
      },
      {
        key: "detangle",
        parentKey: "root",
        title: "Detangle fibers",
        kind: "task",
        category: "style",
        status: "not_started",
      },
      {
        key: "trim",
        parentKey: "root",
        title: "Trim and shape bangs",
        kind: "task",
        category: "style",
        status: "not_started",
      },
      {
        key: "heat",
        parentKey: "root",
        title: "Heat style and set",
        kind: "task",
        category: "style",
        status: "not_started",
      },
    ],
  },
  {
    slug: "prop-build",
    name: "Build Prop",
    description: "A practical prop build workflow.",
    category: "craft",
    items: [
      { key: "root", title: "Prop Build", kind: "group", category: "craft", status: "not_started" },
      {
        key: "cut",
        parentKey: "root",
        title: "Cut base materials",
        kind: "task",
        category: "craft",
        status: "not_started",
      },
      {
        key: "assemble",
        parentKey: "root",
        title: "Assemble structure",
        kind: "task",
        category: "craft",
        status: "not_started",
      },
      {
        key: "finish",
        parentKey: "root",
        title: "Prime, paint, and seal",
        kind: "task",
        category: "craft",
        status: "not_started",
      },
    ],
  },
  {
    slug: "commission-boots",
    name: "Commission Boots",
    description: "Track sourcing and commissioning footwear.",
    category: "buy",
    items: [
      {
        key: "root",
        title: "Commission Boots",
        kind: "group",
        category: "buy",
        status: "not_started",
      },
      {
        key: "measurements",
        parentKey: "root",
        title: "Collect measurements and references",
        kind: "task",
        category: "reference",
        status: "not_started",
      },
      {
        key: "order",
        parentKey: "root",
        title: "Place commission order",
        kind: "task",
        category: "buy",
        status: "not_started",
      },
      {
        key: "fit",
        parentKey: "root",
        title: "Check fit and plan modifications",
        kind: "task",
        category: "modify",
        status: "not_started",
      },
    ],
  },
  {
    slug: "convention-essentials",
    name: "Pack Convention Essentials",
    description: "Core prep and packing tasks for an event weekend.",
    category: "pack",
    items: [
      {
        key: "root",
        title: "Convention Essentials",
        kind: "group",
        category: "pack",
        status: "not_started",
      },
      {
        key: "tickets",
        parentKey: "root",
        title: "Confirm badge, tickets, and ID",
        kind: "task",
        category: "admin",
        status: "not_started",
      },
      {
        key: "repair",
        parentKey: "root",
        title: "Pack emergency repair kit",
        kind: "task",
        category: "pack",
        status: "not_started",
      },
      {
        key: "comfort",
        parentKey: "root",
        title: "Pack water, snacks, and comfort items",
        kind: "task",
        category: "pack",
        status: "not_started",
      },
    ],
  },
  {
    slug: "makeup-test",
    name: "Makeup Test",
    description: "Plan a full trial before the event.",
    category: "prep",
    items: [
      { key: "root", title: "Makeup Test", kind: "group", category: "prep", status: "not_started" },
      {
        key: "references",
        parentKey: "root",
        title: "Collect reference looks",
        kind: "task",
        category: "reference",
        status: "not_started",
      },
      {
        key: "trial",
        parentKey: "root",
        title: "Do a timed full-face trial",
        kind: "task",
        category: "prep",
        status: "not_started",
      },
      {
        key: "adjust",
        parentKey: "root",
        title: "Note adjustments and restock items",
        kind: "task",
        category: "admin",
        status: "not_started",
      },
    ],
  },
] as const;

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

function validateAttachment(input: {
  entityType: string;
  entityId: string;
  role?: string;
  buildContextId?: Id<"builds">;
  progressWeight?: number;
}) {
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

function sanitizeReminders(reminders: Array<{ kind: string; date: string }> | undefined) {
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
  reminders?: Array<{ kind: string; date: string }>;
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

async function ensureBuiltInTemplates(ctx: MutationCtx) {
  for (const template of builtinTemplates) {
    const existing = await ctx.db
      .query("workflowTemplates")
      .withIndex("by_slug", (q) => q.eq("slug", template.slug))
      .unique();
    let templateId: Id<"workflowTemplates">;
    if (existing) {
      templateId = existing._id;
    } else {
      templateId = await ctx.db.insert("workflowTemplates", {
        slug: template.slug,
        name: template.name,
        description: template.description,
        category: template.category,
        isBuiltIn: true,
      });
    }

    const existingItems = await ctx.db
      .query("workflowTemplateItems")
      .withIndex("by_templateId", (q) => q.eq("templateId", templateId))
      .collect();
    if (existingItems.length > 0) continue;

    for (let index = 0; index < template.items.length; index += 1) {
      const item = template.items[index];
      await ctx.db.insert("workflowTemplateItems", {
        templateId,
        templateItemKey: item.key,
        parentTemplateItemKey: "parentKey" in item ? item.parentKey : undefined,
        sortOrder: index,
        title: item.title,
        notes: undefined,
        kind: item.kind,
        category: item.category,
        status: item.status,
        scopeKind: "shared",
        sourceKind: "template",
      });
    }
  }
}

async function replaceAttachments(
  ctx: MutationCtx,
  userId: string,
  workflowItemId: Id<"workflowItems">,
  attachments: Array<{
    entityType: string;
    entityId: string;
    role?: string;
    buildContextId?: Id<"builds">;
    progressWeight?: number;
  }>
) {
  const existing = await ctx.db
    .query("workflowAttachments")
    .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", workflowItemId))
    .collect();
  for (const row of existing) await ctx.db.delete(row._id);
  for (const attachment of attachments) {
    const normalized = validateAttachment(attachment);
    await ctx.db.insert("workflowAttachments", {
      userId,
      workflowItemId,
      ...normalized,
    });
  }
}

async function getSiblingCount(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  parentId: Id<"workflowItems"> | undefined
) {
  const items = await getWorkflowItemsForUser(ctx, userId);
  return items.filter((item) => item.parentId === parentId).length;
}

async function patchDescendantAncestors(
  ctx: MutationCtx,
  userId: string,
  rootId: Id<"workflowItems">,
  newAncestorIds: Id<"workflowItems">[]
) {
  const items = await getWorkflowItemsForUser(ctx, userId);
  const descendants = items
    .filter((item) => item.ancestorIds.includes(rootId))
    .sort((a, b) => a.ancestorIds.length - b.ancestorIds.length);

  for (const descendant of descendants) {
    const movedIndex = descendant.ancestorIds.indexOf(rootId);
    const tail = descendant.ancestorIds.slice(movedIndex);
    await ctx.db.patch(descendant._id, {
      ancestorIds: [...newAncestorIds, ...tail],
    });
  }
}

async function assertWorkflowEditable(
  ctx: MutationCtx,
  item: Doc<"workflowItems">,
  userId: string
) {
  if (item.userId === userId) return;
  const attachments = await ctx.db
    .query("workflowAttachments")
    .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", item._id))
    .collect();
  for (const attachment of attachments) {
    if (attachment.entityType === "build" && attachment.entityId) {
      const allowed = await canUserEditBuild(ctx, attachment.entityId as Id<"builds">, userId);
      if (allowed) return;
    }
  }
  throw new Error("Not authorized");
}

async function canEditWorkflowItem(
  ctx: QueryCtx | MutationCtx,
  item: Doc<"workflowItems">,
  userId: string
) {
  if (item.userId === userId) return true;
  const attachments = await ctx.db
    .query("workflowAttachments")
    .withIndex("by_workflowItemId", (q) => q.eq("workflowItemId", item._id))
    .collect();
  for (const attachment of attachments) {
    if (attachment.entityType !== "build" || !attachment.entityId) continue;
    const buildId = attachment.entityId as Id<"builds">;
    const build = await ctx.db.get(buildId);
    if (!build) continue;
    if (build.userId === userId) return true;
    const collaborators = await ctx.db
      .query("buildCollaborators")
      .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
      .collect();
    if (collaborators.some((row) => row.userId === userId && row.role === "editor")) {
      return true;
    }
  }
  return false;
}

async function buildExternalProgress(ctx: QueryCtx, userId: string, items: WorkflowItemDoc[]) {
  const attachments = await getWorkflowAttachmentsForUser(ctx, userId);
  const itemIdSet = new Set(items.map((item) => item._id));
  const map = new Map<
    string,
    Array<{ progressPercent?: number; weight?: number; excluded?: boolean }>
  >();
  for (const attachment of attachments) {
    if (!itemIdSet.has(attachment.workflowItemId)) continue;
    if (attachment.role !== "progress_source" && attachment.role !== "completion_anchor") continue;
    let progressPercent: number | undefined;
    if (attachment.entityType === "packingItem") {
      const packingItem = await ctx.db.get(attachment.entityId as Id<"packingListItems">);
      progressPercent = packingItem?.checked ? 100 : 0;
    } else if (attachment.entityType === "cosplayNode") {
      const node = await ctx.db.get(attachment.entityId as Id<"cosplayNodes">);
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

async function buildResolvedWorkflowTree(
  ctx: QueryCtx,
  userId: string,
  items: WorkflowItemDoc[],
  attachments: Doc<"workflowAttachments">[]
) {
  const externalProgress = await buildExternalProgress(ctx, userId, items);
  const dependencies = await getWorkflowDependenciesForUser(ctx, userId);
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

export async function getBuildScopedWorkflow(ctx: QueryCtx, buildId: Id<"builds">) {
  const build = await ctx.db.get(buildId);
  if (!build) return null;
  const links = await ctx.db
    .query("buildCosplayLinks")
    .withIndex("by_buildId", (q) => q.eq("buildId", buildId))
    .collect();
  const keys = [
    entityKey("build", buildId),
    ...links.map((link) => entityKey("cosplayNode", link.cosplayNodeId)),
  ];
  const scoped = await getWorkflowItemsByAttachmentKey(ctx, build.userId, keys, buildId);
  const tree = await buildResolvedWorkflowTree(ctx, build.userId, scoped.items, scoped.attachments);
  return { build, tree, items: flattenWorkflowTree(tree) };
}

async function ensureWorkflowItem(
  ctx: MutationCtx,
  input: {
    userId: string;
    dedupeKey: string;
    title: string;
    category: string;
    status?: string;
    attachments: Array<{
      entityType: string;
      entityId: string;
      role?: string;
      buildContextId?: Id<"builds">;
      progressWeight?: number;
    }>;
    scopeKind?: string;
    sourceKind?: string;
    dueDate?: string;
  }
) {
  const existing = await ctx.db
    .query("workflowItems")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", input.dedupeKey))
    .unique();

  const normalizedStatus = coerceStatus(input.status);
  if (existing) {
    await ctx.db.patch(existing._id, {
      title: input.title,
      category: coerceCategory(input.category),
      status: normalizedStatus,
      dueDate: input.dueDate,
      scopeKind: coerceScopeKind(input.scopeKind),
      sourceKind: coerceSourceKind(input.sourceKind),
    });
    await replaceAttachments(ctx, input.userId, existing._id, input.attachments);
    return existing._id;
  }

  const id = await ctx.db.insert("workflowItems", {
    userId: input.userId,
    title: sanitizeAndLimit(input.title, MAX_LENGTH.label, "Workflow title"),
    kind: "task",
    category: coerceCategory(input.category),
    status: normalizedStatus,
    ancestorIds: [],
    sortOrder: 0,
    scopeKind: coerceScopeKind(input.scopeKind),
    sourceKind: coerceSourceKind(input.sourceKind),
    dueDate: input.dueDate,
    dedupeKey: input.dedupeKey,
  });
  await replaceAttachments(ctx, input.userId, id, input.attachments);
  return id;
}

export async function syncGeneratedWorkflowForNode(
  ctx: MutationCtx,
  input: {
    userId: string;
    cosplayNodeId: Id<"cosplayNodes">;
    buildId?: Id<"builds">;
    nodeName: string;
    category?: string | null;
    purchaseStatus?: string | null;
    buildStatus?: string | null;
    materialStatus?: string | null;
  }
) {
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

  if (input.purchaseStatus === "to_buy" || input.materialStatus === "to_buy") {
    await ensureWorkflowItem(ctx, {
      userId: input.userId,
      dedupeKey: `autogen:buy:${input.buildId ?? "shared"}:${input.cosplayNodeId}`,
      title: `Buy ${input.nodeName}`,
      category: "buy",
      status: "not_started",
      scopeKind: input.buildId ? "build_specific" : "shared",
      sourceKind: "automation",
      attachments,
    });
  }

  if (input.buildStatus === "wip" || input.materialStatus === "in_use") {
    const title = input.category?.toLowerCase().includes("wig")
      ? `Style ${input.nodeName}`
      : `Work on ${input.nodeName}`;
    const category = input.category?.toLowerCase().includes("wig") ? "style" : "craft";
    await ensureWorkflowItem(ctx, {
      userId: input.userId,
      dedupeKey: `autogen:wip:${input.buildId ?? "shared"}:${input.cosplayNodeId}`,
      title,
      category,
      status: "in_progress",
      scopeKind: input.buildId ? "build_specific" : "shared",
      sourceKind: "automation",
      attachments,
    });
  }
}

export async function ensurePackingWorkflowItem(
  ctx: MutationCtx,
  input: {
    userId: string;
    packingListItemId: Id<"packingListItems">;
    conventionId: Id<"conventions">;
    buildId?: Id<"builds">;
    cosplayNodeId?: Id<"cosplayNodes">;
    label: string;
    dueDate?: string;
    checked: boolean;
    manual: boolean;
  }
) {
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

  const workflowItemId = await ensureWorkflowItem(ctx, {
    userId: input.userId,
    dedupeKey,
    title: input.label,
    category: "pack",
    status: input.checked ? "done" : "not_started",
    scopeKind: input.buildId ? "build_specific" : "shared",
    sourceKind: "packing",
    dueDate: input.dueDate,
    attachments,
  });
  await ctx.db.patch(input.packingListItemId, {
    workflowItemId,
    entryKind: input.manual ? "manual" : "generated",
    sourceKind: input.manual ? "manual" : "workflow",
  });
  return workflowItemId;
}

export const listTemplates = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const builtIns = await ctx.db
      .query("workflowTemplates")
      .withIndex("by_isBuiltIn", (q) => q.eq("isBuiltIn", true))
      .collect();
    const userTemplates = args.userId
      ? await ctx.db
          .query("workflowTemplates")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .collect()
      : [];
    return [...builtIns, ...userTemplates].sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const seedBuiltinTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    await ensureBuiltInTemplates(ctx);
    return await ctx.db
      .query("workflowTemplates")
      .withIndex("by_isBuiltIn", (q) => q.eq("isBuiltIn", true))
      .collect();
  },
});

export const createTemplate = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    items: v.array(
      v.object({
        templateItemKey: v.string(),
        parentTemplateItemKey: v.optional(v.string()),
        sortOrder: v.number(),
        title: v.string(),
        notes: v.optional(v.string()),
        kind: v.string(),
        category: v.string(),
        status: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const slug = `${args.userId}:${sanitizeString(args.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`;
    const templateId = await ctx.db.insert("workflowTemplates", {
      userId: args.userId,
      slug,
      name: sanitizeAndLimit(args.name, MAX_LENGTH.name, "Template name"),
      description: sanitizeOptional(args.description, MAX_LENGTH.notes, "Template description"),
      category: sanitizeOptional(args.category, MAX_LENGTH.category, "Template category"),
      isBuiltIn: false,
    });
    for (const item of args.items) {
      await ctx.db.insert("workflowTemplateItems", {
        templateId,
        templateItemKey: sanitizeAndLimit(item.templateItemKey, 120, "Template item key"),
        parentTemplateItemKey: sanitizeOptional(
          item.parentTemplateItemKey,
          120,
          "Parent template item key"
        ),
        sortOrder: item.sortOrder,
        title: sanitizeAndLimit(item.title, MAX_LENGTH.label, "Template item title"),
        notes: sanitizeOptional(item.notes, MAX_LENGTH.notes, "Template item notes"),
        kind: coerceKind(item.kind),
        category: coerceCategory(item.category),
        status: coerceStatus(item.status),
        scopeKind: "shared",
        sourceKind: "template",
      });
    }
    return await ctx.db.get(templateId);
  },
});

export const applyTemplate = mutation({
  args: {
    userId: v.string(),
    templateId: v.id("workflowTemplates"),
    attachments: v.array(attachmentValidator),
    buildContextId: v.optional(v.id("builds")),
    scopeKind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureBuiltInTemplates(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (template.userId && template.userId !== args.userId) throw new Error("Not authorized");

    const templateItems = await ctx.db
      .query("workflowTemplateItems")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .collect();
    const createdByKey = new Map<string, Id<"workflowItems">>();
    const createdIds: Id<"workflowItems">[] = [];

    for (const templateItem of [...templateItems].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const parentId = templateItem.parentTemplateItemKey
        ? createdByKey.get(templateItem.parentTemplateItemKey)
        : undefined;
      const parent = parentId ? await ctx.db.get(parentId) : null;
      const workflowItemId = await ctx.db.insert("workflowItems", {
        userId: args.userId,
        title: templateItem.title,
        notes: templateItem.notes,
        kind: templateItem.kind,
        category: templateItem.category,
        status: templateItem.status,
        parentId,
        ancestorIds: parentAncestorIds(parent),
        sortOrder: templateItem.sortOrder,
        scopeKind: coerceScopeKind(args.scopeKind ?? templateItem.scopeKind),
        sourceKind: "template",
        templateId: args.templateId,
      });
      createdByKey.set(templateItem.templateItemKey, workflowItemId);
      createdIds.push(workflowItemId);
      if (!parentId) {
        await replaceAttachments(
          ctx,
          args.userId,
          workflowItemId,
          args.attachments.map((attachment) => ({
            ...attachment,
            buildContextId: attachment.buildContextId ?? args.buildContextId,
          }))
        );
      }
    }

    return await Promise.all(createdIds.map((id) => ctx.db.get(id)));
  },
});

export const listBuildTree = query({
  args: { buildId: v.id("builds"), shareToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId);
    if (!build) return null;
    const identity = await ctx.auth.getUserIdentity();
    const viewerUserId = identity?.subject ?? undefined;
    const allowed = await canReadBuildWorkflowData(ctx, build, {
      viewerUserId,
      shareToken: args.shareToken ?? null,
    });
    if (!allowed) return null;
    const scoped = await getBuildScopedWorkflow(ctx, args.buildId);
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
                    status: item.status as any,
                    manualProgressPercent: item.manualProgressPercent,
                  }),
                0
              ) / scoped.items.length
            )
          : 0;
    return {
      buildId: args.buildId,
      items: scoped.tree,
      stats: {
        tasksTotal: total,
        tasksDone: done,
        workflowProgressPercent,
      },
    };
  },
});

export const listNodeWorkflow = query({
  args: {
    cosplayNodeId: v.id("cosplayNodes"),
    buildId: v.optional(v.id("builds")),
  },
  handler: async (ctx, args) => {
    const node = await ctx.db.get(args.cosplayNodeId);
    if (!node) return null;

    const sharedScoped = await getWorkflowItemsByAttachmentKey(ctx, node.userId, [
      entityKey("cosplayNode", args.cosplayNodeId),
    ]);
    const sharedTree = await buildResolvedWorkflowTree(
      ctx,
      node.userId,
      sharedScoped.items.filter((item) => item.scopeKind === "shared"),
      sharedScoped.attachments
    );

    if (!args.buildId) {
      return { shared: sharedTree, buildSpecific: [] };
    }

    const buildScoped = await getWorkflowItemsByAttachmentKey(
      ctx,
      node.userId,
      [entityKey("cosplayNode", args.cosplayNodeId), entityKey("build", args.buildId)],
      args.buildId
    );
    const buildSpecificTree = await buildResolvedWorkflowTree(
      ctx,
      node.userId,
      buildScoped.items.filter((item) => item.scopeKind === "build_specific"),
      buildScoped.attachments
    );
    return { shared: sharedTree, buildSpecific: buildSpecificTree };
  },
});

export const listPlanner = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const items = await getWorkflowItemsForUser(ctx, args.userId);
    const attachments = await getWorkflowAttachmentsForUser(ctx, args.userId);
    const buildById = new Map<string, Doc<"builds">>();
    const conventionById = new Map<string, Doc<"conventions">>();
    for (const attachment of attachments) {
      if (attachment.entityType === "build" && !buildById.has(attachment.entityId)) {
        const build = await ctx.db.get(attachment.entityId as Id<"builds">);
        if (build) buildById.set(attachment.entityId, build);
      }
      if (attachment.entityType === "convention" && !conventionById.has(attachment.entityId)) {
        const convention = await ctx.db.get(attachment.entityId as Id<"conventions">);
        if (convention) conventionById.set(attachment.entityId, convention);
      }
    }

    const dependencies = await getWorkflowDependenciesForUser(ctx, args.userId);
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

    const today = new Date().toISOString().slice(0, 10);
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
            status: item.status as any,
            manualProgressPercent: item.manualProgressPercent,
          }),
          overdue: isOverdueStatus({ dueDate: item.dueDate, status: item.status as any, today }),
          blockedByCount: blockedByMap.get(item._id) ?? 0,
          blockedByTitles: blockedByTitlesMap.get(item._id) ?? [],
          buildId: buildAttachment?.entityId as Id<"builds"> | undefined,
          buildName: buildAttachment
            ? (buildById.get(buildAttachment.entityId)?.name ?? null)
            : null,
          conventionId: conventionAttachment?.entityId as Id<"conventions"> | undefined,
          conventionName: conventionAttachment
            ? (conventionById.get(conventionAttachment.entityId)?.name ?? null)
            : null,
          cosplayNodeId: nodeAttachment?.entityId as Id<"cosplayNodes"> | undefined,
          packingListItemId: packingAttachment?.entityId as Id<"packingListItems"> | undefined,
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
  },
});

export const getItemEditorState = query({
  args: { id: v.id("workflowItems"), userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const item = await ctx.db.get(args.id);
    if (!item) return null;
    const allowed = await canEditWorkflowItem(ctx, item, args.userId);
    if (!allowed) {
      throw new Error("Not authorized");
    }

    const dependencies = await ctx.db
      .query("workflowDependencies")
      .withIndex("by_successorWorkflowItemId", (q) => q.eq("successorWorkflowItemId", args.id))
      .collect();

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
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    kind: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    parentId: v.optional(v.id("workflowItems")),
    sortOrder: v.optional(v.number()),
    scopeKind: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
    priority: v.optional(v.number()),
    startDate: v.optional(v.string()),
    targetDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    reminders: v.optional(v.array(reminderValidator)),
    weight: v.optional(v.number()),
    manualProgressPercent: v.optional(v.number()),
    estimatedMinutes: v.optional(v.number()),
    actualMinutes: v.optional(v.number()),
    estimatedCostCents: v.optional(v.number()),
    actualCostCents: v.optional(v.number()),
    creatorUserId: v.optional(v.string()),
    ownerUserId: v.optional(v.string()),
    assigneeUserId: v.optional(v.string()),
    templateId: v.optional(v.id("workflowTemplates")),
    recurrenceRule: v.optional(v.string()),
    legacyBuildTaskId: v.optional(v.id("buildTasks")),
    dedupeKey: v.optional(v.string()),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const parent = args.parentId ? await ctx.db.get(args.parentId) : null;
    if (parent && parent.userId !== args.userId) throw new Error("Parent not found");
    if (args.attachments) {
      for (const attachment of args.attachments) {
        if (attachment.entityType === "build") {
          const allowed = await canUserEditBuild(
            ctx,
            attachment.entityId as Id<"builds">,
            args.userId
          );
          if (!allowed) throw new Error("Not authorized");
        }
      }
    }

    const sanitized = sanitizeWorkflowInput(args);
    const workflowItemId = await ctx.db.insert("workflowItems", {
      userId: args.userId,
      title: sanitized.title ?? "",
      notes: sanitized.notes,
      kind: sanitized.kind ?? "task",
      category: sanitized.category ?? "craft",
      status: sanitized.status ?? "not_started",
      parentId: args.parentId,
      ancestorIds: parentAncestorIds(parent),
      sortOrder: args.sortOrder ?? (await getSiblingCount(ctx, args.userId, args.parentId)),
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
      creatorUserId: args.creatorUserId ?? args.userId,
      ownerUserId: args.ownerUserId ?? args.userId,
      assigneeUserId: args.assigneeUserId,
      templateId: args.templateId,
      recurrenceRule: sanitized.recurrenceRule,
      legacyBuildTaskId: args.legacyBuildTaskId,
      dedupeKey: sanitized.dedupeKey,
    });
    if (args.attachments?.length) {
      await replaceAttachments(ctx, args.userId, workflowItemId, args.attachments);
    }
    return await ctx.db.get(workflowItemId);
  },
});

export const update = mutation({
  args: {
    id: v.id("workflowItems"),
    userId: v.string(),
    title: v.optional(v.string()),
    notes: v.optional(v.union(v.string(), v.null())),
    kind: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    scopeKind: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
    priority: v.optional(v.union(v.number(), v.null())),
    startDate: v.optional(v.union(v.string(), v.null())),
    targetDate: v.optional(v.union(v.string(), v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    reminders: v.optional(v.union(v.array(reminderValidator), v.null())),
    weight: v.optional(v.union(v.number(), v.null())),
    manualProgressPercent: v.optional(v.union(v.number(), v.null())),
    estimatedMinutes: v.optional(v.union(v.number(), v.null())),
    actualMinutes: v.optional(v.union(v.number(), v.null())),
    estimatedCostCents: v.optional(v.union(v.number(), v.null())),
    actualCostCents: v.optional(v.union(v.number(), v.null())),
    ownerUserId: v.optional(v.union(v.string(), v.null())),
    assigneeUserId: v.optional(v.union(v.string(), v.null())),
    recurrenceRule: v.optional(v.union(v.string(), v.null())),
    attachments: v.optional(v.array(attachmentValidator)),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Workflow item not found");
    await assertWorkflowEditable(ctx, item, args.userId);
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
    await ctx.db.patch(args.id, patch);
    if (args.attachments) {
      await replaceAttachments(ctx, args.userId, args.id, args.attachments);
    }
    return await ctx.db.get(args.id);
  },
});

export const move = mutation({
  args: {
    id: v.id("workflowItems"),
    userId: v.string(),
    parentId: v.optional(v.union(v.id("workflowItems"), v.null())),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Workflow item not found");
    await assertWorkflowEditable(ctx, item, args.userId);

    const parentId = args.parentId ?? undefined;
    if (parentId && parentId === args.id)
      throw new Error("Workflow items cannot parent themselves");
    if (parentId && item.ancestorIds.includes(parentId)) {
      throw new Error("Workflow items cannot move under a descendant");
    }
    const parent = parentId ? await ctx.db.get(parentId) : null;
    if (parent && parent.userId !== args.userId) throw new Error("Parent not found");
    const ancestorIds = parentAncestorIds(parent);
    await ctx.db.patch(args.id, {
      parentId,
      ancestorIds,
      sortOrder: args.sortOrder ?? item.sortOrder,
    });
    await patchDescendantAncestors(ctx, args.userId, args.id, ancestorIds);
    return await ctx.db.get(args.id);
  },
});

export const setDependencies = mutation({
  args: {
    userId: v.string(),
    workflowItemId: v.id("workflowItems"),
    dependencies: v.array(
      v.object({
        predecessorWorkflowItemId: v.id("workflowItems"),
        relationKind: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.workflowItemId);
    if (!item) throw new Error("Workflow item not found");
    await assertWorkflowEditable(ctx, item, args.userId);
    const existing = await ctx.db
      .query("workflowDependencies")
      .withIndex("by_successorWorkflowItemId", (q) =>
        q.eq("successorWorkflowItemId", args.workflowItemId)
      )
      .collect();
    for (const dependency of existing) await ctx.db.delete(dependency._id);
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
      await ctx.db.insert("workflowDependencies", {
        userId: args.userId,
        predecessorWorkflowItemId: dependency.predecessorWorkflowItemId,
        successorWorkflowItemId: args.workflowItemId,
        relationKind: dependency.relationKind,
      });
    }
    return await ctx.db
      .query("workflowDependencies")
      .withIndex("by_successorWorkflowItemId", (q) =>
        q.eq("successorWorkflowItemId", args.workflowItemId)
      )
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id("workflowItems"), userId: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Workflow item not found");
    await assertWorkflowEditable(ctx, item, args.userId);

    const userItems = await getWorkflowItemsForUser(ctx, item.userId);
    const subtreeIds = userItems
      .filter((candidate) => candidate._id === args.id || candidate.ancestorIds.includes(args.id))
      .map((candidate) => candidate._id);
    const idSet = new Set(subtreeIds);

    const attachments = await getWorkflowAttachmentsForUser(ctx, item.userId);
    for (const attachment of attachments) {
      if (!idSet.has(attachment.workflowItemId)) continue;
      if (attachment.entityType === "packingItem") {
        await ctx.db.patch(attachment.entityId as Id<"packingListItems">, {
          workflowItemId: undefined,
        });
      }
      await ctx.db.delete(attachment._id);
    }

    const dependencies = await getWorkflowDependenciesForUser(ctx, item.userId);
    for (const dependency of dependencies) {
      if (
        idSet.has(dependency.predecessorWorkflowItemId) ||
        idSet.has(dependency.successorWorkflowItemId)
      ) {
        await ctx.db.delete(dependency._id);
      }
    }

    for (const workflowItemId of subtreeIds.reverse()) {
      await ctx.db.delete(workflowItemId);
    }
  },
});

export const getBuildProgressSnapshot = query({
  args: { buildId: v.id("builds") },
  handler: async (ctx, args) => {
    const scoped = await getBuildScopedWorkflow(ctx, args.buildId);
    if (!scoped) return null;
    const { total, done } = deriveDoneCounts(scoped.items);
    const packingItems = (
      await ctx.db
        .query("packingListItems")
        .withIndex("by_userId", (q) => q.eq("userId", scoped.build.userId))
        .collect()
    ).filter((item) => item.buildId === args.buildId);
    const packingProgressPercent =
      packingItems.length > 0
        ? Math.round(
            (packingItems.filter((item) => item.checked).length / packingItems.length) * 100
          )
        : undefined;
    const workflowProgressPercent = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      tasksTotal: total,
      tasksDone: done,
      workflowProgressPercent,
      buildProgressPercent: deriveBuildBlendedProgress({
        manualProgressPercent: scoped.build.manualProgressPercent,
        workflowProgressPercent,
        packingProgressPercent,
      }),
    };
  },
});
