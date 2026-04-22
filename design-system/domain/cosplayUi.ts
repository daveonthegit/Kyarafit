import type {
  CosplayOverallBucket,
  CosplayNodeType,
  ElementBuildStatus,
  ElementPurchaseStatus,
  MaterialStatus,
} from "../types";

export type CosplayExplorerItem = {
  _id: string;
  nodeType: CosplayNodeType;
  name: string;
  category?: string;
  tags?: string[];
  notes?: string;
  imageUrl?: string | null;
  imageStorageId?: string | null;
  sourceUrl?: string | null;
  directCostCents?: number | null;
  totalCostCents?: number | null;
  progressPercent?: number | null;
  overallBucket?: CosplayOverallBucket;
  purchaseStatus?: ElementPurchaseStatus | null;
  buildStatus?: ElementBuildStatus | null;
  materialStatus?: MaterialStatus | null;
  childCount?: number;
  hasIncompleteDescendants?: boolean;
  _creationTime?: number;
};

export function formatNodeTypeLabel(nodeType: CosplayNodeType | undefined) {
  return nodeType === "material" ? "Material" : "Element";
}

export function formatOverallBucket(bucket: CosplayOverallBucket | string | undefined) {
  switch (bucket) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In progress";
    default:
      return "Incomplete";
  }
}

export function formatNodeStatus(item: {
  nodeType?: CosplayNodeType | string;
  overallBucket?: CosplayOverallBucket | string;
  purchaseStatus?: ElementPurchaseStatus | string | null;
  buildStatus?: ElementBuildStatus | string | null;
  materialStatus?: MaterialStatus | string | null;
}) {
  if (item.nodeType === "material") {
    switch (item.materialStatus) {
      case "complete":
        return "Complete";
      case "in_use":
        return "In use";
      case "bought":
        return "Bought";
      default:
        return formatOverallBucket(item.overallBucket);
    }
  }

  if (item.buildStatus === "built") return "Built";
  if (item.buildStatus === "wip") return "WIP";
  if (item.purchaseStatus === "bought") return "Bought";
  return formatOverallBucket(item.overallBucket);
}

export function nodeMatchesSubstate(item: CosplayExplorerItem, substate: string) {
  return (
    item.purchaseStatus === substate ||
    item.buildStatus === substate ||
    item.materialStatus === substate
  );
}

export function nodeSearchText(item: CosplayExplorerItem) {
  return [
    item.name,
    item.category ?? "",
    item.notes ?? "",
    ...(item.tags ?? []),
    formatNodeTypeLabel(item.nodeType),
    formatNodeStatus(item),
  ]
    .join(" ")
    .toLowerCase();
}

export function formatCostSummary(item: {
  directCostCents?: number | null;
  totalCostCents?: number | null;
}) {
  const direct = item.directCostCents ?? 0;
  const total = item.totalCostCents ?? direct;
  if (total <= 0 && direct <= 0) return "No cost";
  if (total !== direct) return `Own ${direct} / Rollup ${total}`;
  return `Total ${total}`;
}
