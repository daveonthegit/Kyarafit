import type { Id } from "convex/_generated/dataModel";

export type CosplayNodeId = Id<"cosplayNodes">;

export type ExplorerLinkedNode = {
  _id: CosplayNodeId;
  name: string;
  nodeType: "element" | "material";
  category?: string;
  tags?: string[];
  totalCostCents?: number | null;
  directCostCents?: number | null;
  overallBucket?: "incomplete" | "in_progress" | "complete";
  purchaseStatus?: string | null;
  buildStatus?: string | null;
  materialStatus?: string | null;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  progressPercent?: number | null;
  childCount?: number | null;
};

export type DetailedLinkedNode = ExplorerLinkedNode & {
  notes?: string | null;
  children: Array<
    ExplorerLinkedNode & {
      _id: CosplayNodeId;
      linkId: Id<"cosplayNodeLinks">;
      linkMode: "owned" | "reference";
      sortOrder: number;
    }
  >;
};

export type NodeSelectionMeta = {
  nodeId: CosplayNodeId;
  isRoot: boolean;
  rootIndex?: number;
  parentNodeId?: CosplayNodeId;
  siblingLinkIds?: Id<"cosplayNodeLinks">[];
  siblingIndex?: number;
};

export type PathSegment = {
  meta: NodeSelectionMeta;
  label: string;
};

export type DropZone = "before" | "into" | "after";

export type DragState = {
  draggingNodeId: CosplayNodeId | null;
  draggingMeta: NodeSelectionMeta | null;
  dragOverNodeId: CosplayNodeId | "__root__" | null;
  dragOverZone: DropZone | null;
  pointerX: number | null;
  pointerY: number | null;
};

export type ElementCombinedStatus = "to_buy" | "materials_ready" | "wip" | "built";

export const ELEMENT_COMBINED_OPTIONS: { value: ElementCombinedStatus; label: string }[] = [
  { value: "to_buy", label: "To buy" },
  { value: "materials_ready", label: "Bought" },
  { value: "wip", label: "In progress" },
  { value: "built", label: "Built" },
];

export const MATERIAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "to_buy", label: "To buy" },
  { value: "bought", label: "Bought" },
  { value: "in_use", label: "In use" },
  { value: "complete", label: "Complete" },
];

export function elementCombinedFromDb(
  purchaseStatus?: string | null,
  buildStatus?: string | null
): ElementCombinedStatus {
  const build = buildStatus ?? "not_started";
  if (build === "built") return "built";
  if (build === "wip") return "wip";
  return (purchaseStatus ?? "to_buy") === "bought" ? "materials_ready" : "to_buy";
}

export function dbFromElementCombined(combined: ElementCombinedStatus): {
  purchaseStatus: string;
  buildStatus: string;
} {
  switch (combined) {
    case "to_buy":
      return { purchaseStatus: "to_buy", buildStatus: "not_started" };
    case "materials_ready":
      return { purchaseStatus: "bought", buildStatus: "not_started" };
    case "wip":
      return { purchaseStatus: "bought", buildStatus: "wip" };
    case "built":
      return { purchaseStatus: "bought", buildStatus: "built" };
  }
}

export function isAllowedChildLink(
  parentType: ExplorerLinkedNode["nodeType"],
  childType: ExplorerLinkedNode["nodeType"]
) {
  if (parentType === "element") return true;
  return childType === "material";
}

export function canReorderAsSiblings(a: NodeSelectionMeta, b: NodeSelectionMeta) {
  if (a.nodeId === b.nodeId) return false;
  if (a.isRoot && b.isRoot) return true;
  if (!a.isRoot && !b.isRoot && a.parentNodeId === b.parentNodeId) return true;
  return false;
}

export function moveBefore<T>(arr: T[], from: number, target: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(from < target ? target - 1 : target, 0, x);
  return a;
}

export function moveAfter<T>(arr: T[], from: number, target: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(from < target ? target : target + 1, 0, x);
  return a;
}

export function parseSelectionMeta(raw: string | undefined): NodeSelectionMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NodeSelectionMeta;
  } catch {
    return null;
  }
}

export function computeDropZone(
  clientY: number,
  rect: DOMRect,
  dragged: NodeSelectionMeta | null,
  target: NodeSelectionMeta,
  draggedNode: ExplorerLinkedNode | undefined,
  targetNode: ExplorerLinkedNode | undefined
): DropZone | null {
  if (!dragged || !draggedNode || !targetNode || dragged.nodeId === target.nodeId) return null;
  const ratio = (clientY - rect.top) / Math.max(rect.height, 1);
  const canReorder = canReorderAsSiblings(dragged, target);
  const canNest = isAllowedChildLink(targetNode.nodeType, draggedNode.nodeType);
  if (canReorder && canNest) {
    if (ratio < 0.22) return "before";
    if (ratio > 0.78) return "after";
    return "into";
  }
  if (canReorder) {
    return ratio < 0.5 ? "before" : "after";
  }
  if (canNest) {
    return "into";
  }
  return null;
}

export function pointInsideRect(clientX: number, clientY: number, rect: DOMRect) {
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

export function statusChipInfo(node: ExplorerLinkedNode): { label: string; tone: "neutral" | "warning" | "active" | "success" } {
  if (node.nodeType === "material") {
    switch (node.materialStatus) {
      case "complete":
        return { label: "Complete", tone: "success" };
      case "in_use":
        return { label: "In use", tone: "active" };
      case "bought":
        return { label: "Bought", tone: "warning" };
      default:
        return { label: "To buy", tone: "neutral" };
    }
  }
  if (node.buildStatus === "built") return { label: "Built", tone: "success" };
  if (node.buildStatus === "wip") return { label: "WIP", tone: "active" };
  if (node.purchaseStatus === "bought") return { label: "Bought", tone: "warning" };
  return { label: "To buy", tone: "neutral" };
}
