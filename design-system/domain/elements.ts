/**
 * SPEC STUB — NOT IMPLEMENTED. Throws until implemented per PRODUCT_SPEC.md §4.2 (REQ-040/41/42/44)
 * and DATA_AND_SYNC.md §3.1.
 *
 * Pure logic for the canonical Element model (replaces the `cosplayNodes` graph + `closetItems`).
 * Elements form a build-scoped hierarchy (parent/child); reuse is duplicate-to-build, not a shared
 * graph. The surviving concepts from the old graph (cost normalization, progress derivation, cycle
 * prevention, search text) live here, retargeted to elements. The old `material` nodeType and
 * link-rule semantics are intentionally gone.
 *
 * Do NOT change the spec tests to match a different behavior.
 */

export interface ElementLike {
  name: string;
  category?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface ElementCostInput {
  pricingMode?: string; // "per_unit" | "total"
  directCostCents?: number;
  unitCostCents?: number;
  quantity?: number;
}

export interface ElementProgressInput {
  /** Completion buckets of child elements: "complete" | "in_progress" | "incomplete". */
  childBuckets?: string[];
  taskCount?: number;
  completedTaskCount?: number;
  /** Own status bucket when there are no children/tasks. */
  ownBucket?: string;
}

/** Normalized own cost in cents: per_unit => unitCost*quantity, else directCost. */
export function normalizeElementCostCents(input: ElementCostInput): number {
  if (input.pricingMode === "per_unit") {
    return (input.unitCostCents ?? 0) * (input.quantity ?? 0);
  }
  return input.directCostCents ?? 0;
}

function bucketCompletion(bucket: string | undefined): number {
  switch (bucket) {
    case "complete":
      return 1;
    case "in_progress":
      return 0.5;
    default:
      return 0;
  }
}

/**
 * Element completion percent (0..100) derived from child + task completion, or own bucket.
 *
 * Unit model: each child element and each task counts as one unit. A "complete" child contributes a
 * full unit, "in_progress" half a unit, "incomplete" none; each completed task contributes a full
 * unit. Percent = completed units / total units * 100. With no children or tasks, fall back to the
 * element's own bucket.
 */
export function deriveElementProgressPercent(input: ElementProgressInput): number {
  const childBuckets = input.childBuckets ?? [];
  const taskCount = input.taskCount ?? 0;
  const completedTaskCount = input.completedTaskCount ?? 0;

  const totalUnits = childBuckets.length + taskCount;

  if (totalUnits === 0) {
    return Math.round(bucketCompletion(input.ownBucket) * 100);
  }

  const completedUnits =
    childBuckets.reduce((sum, bucket) => sum + bucketCompletion(bucket), 0) + completedTaskCount;

  return Math.round((completedUnits / totalUnits) * 100);
}

/**
 * Whether re-parenting would create a cycle in the element tree. `getChildren` returns the direct
 * child element ids of a given element id. A cycle occurs when `newParentId` is `childId` itself, or
 * when `childId` is already a descendant of `newParentId` (so making it the parent would close a
 * loop). Detected by walking the descendants of `newParentId` looking for `childId`.
 */
export async function wouldCreateElementCycle(
  childId: string,
  newParentId: string,
  getChildren: (id: string) => Promise<string[]>
): Promise<boolean> {
  if (childId === newParentId) {
    return true;
  }

  const visited = new Set<string>();
  const stack = [newParentId];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const children = await getChildren(current);
    for (const next of children) {
      if (next === childId) {
        return true;
      }
      if (!visited.has(next)) {
        stack.push(next);
      }
    }
  }

  return false;
}

export interface ElementRecord {
  id: string;
  buildId: string;
  parentElementId?: string | null;
  name: string;
  [key: string]: unknown;
}

export interface DuplicatedElement {
  buildId: string;
  parentElementId: null;
  name: string;
  [key: string]: unknown;
}

/**
 * SPEC STUB — NOT IMPLEMENTED (REQ-042). Duplicate an element into another build as an INDEPENDENT
 * copy: the result targets `targetBuildId`, is placed at the root (no parent), drops the source
 * identity (`id`), and carries the source's data fields. Reuse is copy, never a shared graph.
 */
export function duplicateElementForBuild(
  element: ElementRecord,
  targetBuildId: string
): DuplicatedElement {
  const { id: _id, ...rest } = element;
  return { ...rest, buildId: targetBuildId, parentElementId: null };
}

/** Lowercased searchable text combining name, category, tags, and notes. */
export function elementSearchText(element: ElementLike): string {
  const parts: string[] = [element.name];
  if (element.category) {
    parts.push(element.category);
  }
  if (element.tags) {
    parts.push(...element.tags);
  }
  if (element.notes) {
    parts.push(element.notes);
  }
  return parts.join(" ").toLowerCase();
}
