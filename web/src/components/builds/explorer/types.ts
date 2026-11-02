import type { Id } from "convex/_generated/dataModel";
import {
  canReorderAsSiblings as sharedCanReorderAsSiblings,
  computeDropZone as sharedComputeDropZone,
  dbFromElementCombined as sharedDbFromElementCombined,
  elementCombinedFromDb as sharedElementCombinedFromDb,
  formatCents as sharedFormatCents,
  isAllowedChildLink as sharedIsAllowedChildLink,
  moveAfter as sharedMoveAfter,
  moveBefore as sharedMoveBefore,
  parseSelectionMeta as sharedParseSelectionMeta,
  pointInsideRect as sharedPointInsideRect,
  statusChipInfo as sharedStatusChipInfo,
  ELEMENT_COMBINED_OPTIONS as SHARED_ELEMENT_COMBINED_OPTIONS,
  MATERIAL_STATUS_OPTIONS as SHARED_MATERIAL_STATUS_OPTIONS,
  type DropZone as SharedDropZone,
  type ElementCombinedStatus as SharedElementCombinedStatus,
} from "@kyarafit/design-system/domain";

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
      // Step 2c: nesting lives on the node; the "link id" is the child node's own id.
      linkId: Id<"cosplayNodes">;
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
  siblingLinkIds?: Id<"cosplayNodes">[];
  siblingIndex?: number;
};

export type PathSegment = {
  meta: NodeSelectionMeta;
  label: string;
};

export type DropZone = SharedDropZone;

export type DragState = {
  draggingNodeId: CosplayNodeId | null;
  draggingMeta: NodeSelectionMeta | null;
  dragOverNodeId: CosplayNodeId | "__root__" | null;
  dragOverZone: DropZone | null;
  pointerX: number | null;
  pointerY: number | null;
};

export type ElementCombinedStatus = SharedElementCombinedStatus;

export const ELEMENT_COMBINED_OPTIONS = SHARED_ELEMENT_COMBINED_OPTIONS;
export const MATERIAL_STATUS_OPTIONS = SHARED_MATERIAL_STATUS_OPTIONS;

export const elementCombinedFromDb = sharedElementCombinedFromDb;
export const dbFromElementCombined = sharedDbFromElementCombined;

export function isAllowedChildLink(
  parentType: ExplorerLinkedNode["nodeType"],
  childType: ExplorerLinkedNode["nodeType"]
) {
  return sharedIsAllowedChildLink(parentType, childType);
}

export function canReorderAsSiblings(a: NodeSelectionMeta, b: NodeSelectionMeta) {
  return sharedCanReorderAsSiblings(a, b);
}

export const moveBefore = sharedMoveBefore;
export const moveAfter = sharedMoveAfter;

export function parseSelectionMeta(raw: string | undefined): NodeSelectionMeta | null {
  // Shared parser returns string-typed IDs; cast to web's branded Id type at boundary.
  return sharedParseSelectionMeta(raw) as NodeSelectionMeta | null;
}

export function computeDropZone(
  clientY: number,
  rect: DOMRect,
  dragged: NodeSelectionMeta | null,
  target: NodeSelectionMeta,
  draggedNode: ExplorerLinkedNode | undefined,
  targetNode: ExplorerLinkedNode | undefined
): DropZone | null {
  return sharedComputeDropZone(clientY, rect, dragged, target, draggedNode, targetNode);
}

export function pointInsideRect(clientX: number, clientY: number, rect: DOMRect) {
  return sharedPointInsideRect(clientX, clientY, rect);
}

export const formatCents = sharedFormatCents;

export function statusChipInfo(node: ExplorerLinkedNode): {
  label: string;
  tone: "neutral" | "warning" | "active" | "success";
} {
  return sharedStatusChipInfo(node);
}
