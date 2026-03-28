export const COSPLAY_NODE_TYPES = ["element", "material"] as const;
export type CosplayNodeType = (typeof COSPLAY_NODE_TYPES)[number];

export const ELEMENT_PURCHASE_STATUSES = ["to_buy", "bought"] as const;
export type ElementPurchaseStatus = (typeof ELEMENT_PURCHASE_STATUSES)[number];

export const ELEMENT_BUILD_STATUSES = ["not_started", "wip", "built"] as const;
export type ElementBuildStatus = (typeof ELEMENT_BUILD_STATUSES)[number];

export const MATERIAL_STATUSES = ["to_buy", "bought", "in_use", "complete"] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const OVERALL_BUCKETS = ["incomplete", "in_progress", "complete"] as const;
export type OverallBucket = (typeof OVERALL_BUCKETS)[number];

export function isAllowedLink(
  parentType: CosplayNodeType,
  childType: CosplayNodeType
): boolean {
  return (
    (parentType === "element" && childType === "element") ||
    (parentType === "material" && childType === "material") ||
    (parentType === "material" && childType === "element")
  );
}

export function normalizeDirectCostCents(input: {
  pricingMode?: string | null;
  directCostCents?: number | null;
  unitCostCents?: number | null;
  quantity?: number | null;
}): number {
  if (input.pricingMode === "per_unit") {
    const unitCost = input.unitCostCents ?? 0;
    const quantity = input.quantity ?? 0;
    return Math.round(unitCost * quantity);
  }
  return input.directCostCents ?? 0;
}

export function rankBucket(bucket: OverallBucket | undefined | null): number {
  if (bucket === "complete") return 2;
  if (bucket === "in_progress") return 1;
  return 0;
}

export function deriveElementOverallBucket(input: {
  manualOverallBucket?: OverallBucket | null;
  purchaseStatus?: ElementPurchaseStatus | null;
  buildStatus?: ElementBuildStatus | null;
  childBuckets?: OverallBucket[];
  taskCount?: number;
  completedTaskCount?: number;
}): OverallBucket {
  if (input.manualOverallBucket) return input.manualOverallBucket;

  const childBuckets = input.childBuckets ?? [];
  const taskCount = input.taskCount ?? 0;
  const completedTaskCount = input.completedTaskCount ?? 0;

  if (childBuckets.length > 0) {
    const allChildrenComplete = childBuckets.every((bucket) => bucket === "complete");
    const anyChildProgress = childBuckets.some((bucket) => bucket === "in_progress");
    const tasksComplete = taskCount === 0 || completedTaskCount === taskCount;

    if (allChildrenComplete && tasksComplete) return "complete";
    if (anyChildProgress || completedTaskCount > 0) return "in_progress";
    return "incomplete";
  }

  if (input.purchaseStatus === "bought" || input.buildStatus === "built") return "complete";
  if (input.buildStatus === "wip" || completedTaskCount > 0) return "in_progress";
  return "incomplete";
}

export function deriveMaterialOverallBucket(input: {
  manualOverallBucket?: OverallBucket | null;
  materialStatus?: MaterialStatus | null;
  childBuckets?: OverallBucket[];
  taskCount?: number;
  completedTaskCount?: number;
}): OverallBucket {
  if (input.manualOverallBucket) return input.manualOverallBucket;
  if (input.materialStatus === "complete") return "complete";
  if (input.materialStatus === "in_use") return "in_progress";

  const childBuckets = input.childBuckets ?? [];
  const taskCount = input.taskCount ?? 0;
  const completedTaskCount = input.completedTaskCount ?? 0;
  if (childBuckets.some((bucket) => bucket === "in_progress") || completedTaskCount > 0) {
    return "in_progress";
  }
  if (childBuckets.length > 0 && childBuckets.every((bucket) => bucket === "complete")) {
    return "complete";
  }
  return "incomplete";
}

export function deriveProgressPercent(input: {
  ownBucket?: OverallBucket | null;
  childBuckets?: OverallBucket[];
  taskCount?: number;
  completedTaskCount?: number;
}): number {
  const childBuckets = input.childBuckets ?? [];
  const taskCount = input.taskCount ?? 0;
  const completedTaskCount = input.completedTaskCount ?? 0;

  const unitCount = childBuckets.length + taskCount;
  if (unitCount > 0) {
    const completedChildren = childBuckets.filter((bucket) => bucket === "complete").length;
    return Math.round(((completedChildren + completedTaskCount) / unitCount) * 100);
  }

  if (input.ownBucket === "complete") return 100;
  if (input.ownBucket === "in_progress") return 50;
  return 0;
}

export async function wouldCreateCycle(
  parentId: string,
  childId: string,
  getChildren: (nodeId: string) => Promise<string[]>
): Promise<boolean> {
  if (parentId === childId) return true;

  const queue = [childId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === parentId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const children = await getChildren(current);
    for (const next of children) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return false;
}
