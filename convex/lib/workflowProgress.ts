export const WORKFLOW_ITEM_KINDS = ["task", "milestone", "group"] as const;
export type WorkflowItemKind = (typeof WORKFLOW_ITEM_KINDS)[number];

export const WORKFLOW_CATEGORIES = [
  "buy",
  "craft",
  "modify",
  "repair",
  "style",
  "pack",
  "prep",
  "reference",
  "admin",
] as const;
export type WorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const WORKFLOW_STATUSES = [
  "not_started",
  "scheduled",
  "in_progress",
  "blocked",
  "waiting",
  "done",
  "cancelled",
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_SCOPE_KINDS = ["shared", "build_specific"] as const;
export type WorkflowScopeKind = (typeof WORKFLOW_SCOPE_KINDS)[number];

export const WORKFLOW_SOURCE_KINDS = ["manual", "template", "automation", "packing"] as const;
export type WorkflowSourceKind = (typeof WORKFLOW_SOURCE_KINDS)[number];

export const WORKFLOW_DEPENDENCY_KINDS = ["prerequisite", "blocks", "related"] as const;
export type WorkflowDependencyKind = (typeof WORKFLOW_DEPENDENCY_KINDS)[number];

export const WORKFLOW_ENTITY_TYPES = [
  "build",
  "cosplayNode",
  "convention",
  "packingItem",
  "plannerBucket",
] as const;
export type WorkflowEntityType = (typeof WORKFLOW_ENTITY_TYPES)[number];

export const WORKFLOW_ATTACHMENT_ROLES = [
  "primary",
  "context",
  "progress_source",
  "completion_anchor",
  "packing_entry",
  "planner_bucket",
  "reference",
] as const;
export type WorkflowAttachmentRole = (typeof WORKFLOW_ATTACHMENT_ROLES)[number];

export const WORKFLOW_STATUS_PROGRESS: Record<WorkflowStatus, number> = {
  not_started: 0,
  scheduled: 10,
  waiting: 10,
  blocked: 25,
  in_progress: 50,
  done: 100,
  cancelled: 0,
};

export function normalizePercent(value: number | undefined | null): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function isWorkflowStatus(value: string | undefined | null): value is WorkflowStatus {
  return WORKFLOW_STATUSES.includes(value as WorkflowStatus);
}

export function isWorkflowKind(value: string | undefined | null): value is WorkflowItemKind {
  return WORKFLOW_ITEM_KINDS.includes(value as WorkflowItemKind);
}

export function isWorkflowCategory(value: string | undefined | null): value is WorkflowCategory {
  return WORKFLOW_CATEGORIES.includes(value as WorkflowCategory);
}

export function isWorkflowScopeKind(value: string | undefined | null): value is WorkflowScopeKind {
  return WORKFLOW_SCOPE_KINDS.includes(value as WorkflowScopeKind);
}

export function isWorkflowSourceKind(
  value: string | undefined | null
): value is WorkflowSourceKind {
  return WORKFLOW_SOURCE_KINDS.includes(value as WorkflowSourceKind);
}

export function deriveStatusProgress(input: {
  status?: WorkflowStatus | null;
  manualProgressPercent?: number | null;
}): number {
  const manual = normalizePercent(input.manualProgressPercent);
  if (manual != null) return manual;
  if (!input.status) return 0;
  return WORKFLOW_STATUS_PROGRESS[input.status];
}

type WeightedProgressUnit = {
  weight?: number | null;
  progressPercent?: number | null;
  excluded?: boolean;
};

export function deriveWeightedProgress(units: WeightedProgressUnit[]): number {
  let numerator = 0;
  let denominator = 0;
  for (const unit of units) {
    if (unit.excluded) continue;
    const progress = normalizePercent(unit.progressPercent) ?? 0;
    const weight =
      unit.weight != null && Number.isFinite(unit.weight) && unit.weight > 0 ? unit.weight : 1;
    numerator += progress * weight;
    denominator += weight;
  }
  if (denominator === 0) return 0;
  return Math.round(numerator / denominator);
}

export function deriveWorkflowAggregateProgress(input: {
  kind?: WorkflowItemKind | null;
  status?: WorkflowStatus | null;
  manualProgressPercent?: number | null;
  childProgress: Array<{
    weight?: number | null;
    progressPercent?: number | null;
    excluded?: boolean;
  }>;
  attachedProgress?: Array<{
    weight?: number | null;
    progressPercent?: number | null;
    excluded?: boolean;
  }>;
}): number {
  const childUnits = [...input.childProgress, ...(input.attachedProgress ?? [])];
  if ((input.kind === "group" || input.kind === "milestone") && childUnits.length > 0) {
    return deriveWeightedProgress(childUnits);
  }
  return deriveStatusProgress({
    status: input.status ?? undefined,
    manualProgressPercent: input.manualProgressPercent ?? undefined,
  });
}

export function deriveBuildBlendedProgress(input: {
  manualProgressPercent?: number | null;
  workflowProgressPercent?: number | null;
  nodeProgressPercent?: number | null;
  packingProgressPercent?: number | null;
}): number {
  const manual = normalizePercent(input.manualProgressPercent);
  if (manual != null) return manual;

  const units = [
    {
      progressPercent: input.workflowProgressPercent,
      weight: 50,
      excluded: input.workflowProgressPercent == null,
    },
    {
      progressPercent: input.nodeProgressPercent,
      weight: 35,
      excluded: input.nodeProgressPercent == null,
    },
    {
      progressPercent: input.packingProgressPercent,
      weight: 15,
      excluded: input.packingProgressPercent == null,
    },
  ];
  return deriveWeightedProgress(units);
}

export function isDoneStatus(status: WorkflowStatus | undefined | null): boolean {
  return status === "done";
}

export function isTerminalStatus(status: WorkflowStatus | undefined | null): boolean {
  return status === "done" || status === "cancelled";
}

export function isOverdueStatus(input: {
  dueDate?: string | null;
  status?: WorkflowStatus | null;
  today: string;
}): boolean {
  if (!input.dueDate || isTerminalStatus(input.status)) return false;
  return input.dueDate < input.today;
}
