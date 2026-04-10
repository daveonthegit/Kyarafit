"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { formatNodeStatus, formatNodeTypeLabel } from "@/lib/cosplayUi";

type CosplayNodeId = Id<"cosplayNodes">;

export type BuildNodeManagerLinkedNode = {
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

type DetailedLinkedNode = BuildNodeManagerLinkedNode & {
  notes?: string | null;
  children: Array<
    BuildNodeManagerLinkedNode & {
      _id: CosplayNodeId;
      linkId: Id<"cosplayNodeLinks">;
      linkMode: "owned" | "reference";
      sortOrder: number;
    }
  >;
};

type NodeSelectionMeta = {
  nodeId: CosplayNodeId;
  isRoot: boolean;
  rootIndex?: number;
  parentNodeId?: CosplayNodeId;
  siblingLinkIds?: Id<"cosplayNodeLinks">[];
  siblingIndex?: number;
};

type PathSegment = {
  meta: NodeSelectionMeta;
  label: string;
};

type DropZone = "before" | "into" | "after";

type DragState = {
  draggingNodeId: CosplayNodeId | null;
  draggingMeta: NodeSelectionMeta | null;
  dragOverNodeId: CosplayNodeId | "__root__" | null;
  dragOverZone: DropZone | null;
  pointerX: number | null;
  pointerY: number | null;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

/** Single UI control for elements; still maps to purchaseStatus + buildStatus in Convex. */
type ElementCombinedStatus = "to_buy" | "materials_ready" | "wip" | "built";

const ELEMENT_COMBINED_OPTIONS: { value: ElementCombinedStatus; label: string }[] = [
  { value: "to_buy", label: "To buy" },
  { value: "materials_ready", label: "Bought" },
  { value: "wip", label: "In progress" },
  { value: "built", label: "Built" },
];

function elementCombinedFromDb(
  purchaseStatus?: string | null,
  buildStatus?: string | null
): ElementCombinedStatus {
  const build = buildStatus ?? "not_started";
  if (build === "built") return "built";
  if (build === "wip") return "wip";
  return (purchaseStatus ?? "to_buy") === "bought" ? "materials_ready" : "to_buy";
}

function dbFromElementCombined(combined: ElementCombinedStatus): {
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

function isAllowedChildLink(
  parentType: BuildNodeManagerLinkedNode["nodeType"],
  childType: BuildNodeManagerLinkedNode["nodeType"]
) {
  if (parentType === "element") return true;
  return childType === "material";
}

function visibleBucket(bucket?: BuildNodeManagerLinkedNode["overallBucket"]) {
  return bucket === "complete" ? "complete" : "in_progress";
}

function nodeIcon(nodeType?: BuildNodeManagerLinkedNode["nodeType"]) {
  return (
    <span className="material-symbols-outlined shrink-0 text-base text-kyar-textTertiary">
      {nodeType === "material" ? "inventory_2" : "checkroom"}
    </span>
  );
}

function canReorderAsSiblings(a: NodeSelectionMeta, b: NodeSelectionMeta) {
  if (a.nodeId === b.nodeId) return false;
  if (a.isRoot && b.isRoot) return true;
  if (!a.isRoot && !b.isRoot && a.parentNodeId === b.parentNodeId) return true;
  return false;
}

function moveBefore<T>(arr: T[], from: number, target: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(from < target ? target - 1 : target, 0, x);
  return a;
}

function moveAfter<T>(arr: T[], from: number, target: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(from < target ? target : target + 1, 0, x);
  return a;
}

function parseSelectionMeta(raw: string | undefined): NodeSelectionMeta | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NodeSelectionMeta;
  } catch {
    return null;
  }
}

function computeDropZone(
  clientY: number,
  rect: DOMRect,
  dragged: NodeSelectionMeta | null,
  target: NodeSelectionMeta,
  draggedNode: BuildNodeManagerLinkedNode | undefined,
  targetNode: BuildNodeManagerLinkedNode | undefined
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

function pointInsideRect(clientX: number, clientY: number, rect: DOMRect) {
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function NodeThumb({
  node,
  detail,
}: {
  node: BuildNodeManagerLinkedNode;
  detail: DetailedLinkedNode | null | undefined;
}) {
  const storageId = detail?.imageStorageId ?? node.imageStorageId;
  const url = detail?.imageUrl ?? node.imageUrl;
  const hasImage = Boolean(storageId || url);
  return (
    <div className="flex h-11 w-11 shrink-0 overflow-hidden rounded-md border border-kyar-borderSubtle bg-kyar-muted">
      {hasImage ? (
        <ResolvedImage
          imageStorageId={storageId ?? null}
          imageUrl={url ?? null}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          {nodeIcon(node.nodeType)}
        </div>
      )}
    </div>
  );
}

function DragPreviewRow({
  node,
  label,
  depth = 0,
  variant = "inline",
}: {
  node: BuildNodeManagerLinkedNode;
  label: string;
  depth?: number;
  variant?: "inline" | "floating";
}) {
  const isFloating = variant === "floating";
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        isFloating
          ? "border border-kyar-borderSubtle bg-kyar-surface/95 shadow-card backdrop-blur-[2px]"
          : "border border-dashed border-kyar-borderSubtle bg-kyar-text/5"
      }`}
      style={depth > 0 && !isFloating ? ({ marginLeft: depth * 16 } as CSSProperties) : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 min-w-[32px] shrink-0 items-center justify-center text-kyar-textTertiary">
          <span className="material-symbols-outlined text-lg" aria-hidden>
            drag_indicator
          </span>
        </span>
        <NodeThumb node={node} detail={null} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-kyar-text">{node.name}</p>
          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">{label}</p>
        </div>
      </div>
    </div>
  );
}

type BuildNodeManagerSectionProps = {
  buildId: Id<"builds">;
  buildName: string;
  userId: string | null;
  linkedNodes: BuildNodeManagerLinkedNode[];
  linkedNodeIds: CosplayNodeId[];
  onOpenLinkNodes: () => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
};

export function BuildNodeManagerSection({
  buildId,
  buildName,
  userId,
  linkedNodes,
  linkedNodeIds,
  onOpenLinkNodes,
  onCreateRoot,
  onCreateChild,
}: BuildNodeManagerSectionProps) {
  const updateNode = useMutation(api.cosplayNodes.update);
  const linkNodes = useMutation(api.builds.linkNodes);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const allNodes = (useQuery(api.cosplayNodes.list, userId ? { userId, sortBy: "name" } : "skip") ??
    []) as BuildNodeManagerLinkedNode[];

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NodeSelectionMeta | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathSegment[]>([]);
  const [drag, setDrag] = useState<DragState>({
    draggingNodeId: null,
    draggingMeta: null,
    dragOverNodeId: null,
    dragOverZone: null,
    pointerX: null,
    pointerY: null,
  });
  const [graphError, setGraphError] = useState<string | null>(null);
  const [persistStatus, setPersistStatus] = useState<"saved" | "dirty" | "saving" | "error">(
    "saved"
  );
  const [inspectorForm, setInspectorForm] = useState({
    name: "",
    notes: "",
    directCostDollars: "",
    elementCombinedStatus: "to_buy" as ElementCombinedStatus,
    materialStatus: "to_buy",
  });

  const draggingMetaRef = useRef<NodeSelectionMeta | null>(null);
  const dragStateRef = useRef<DragState>(drag);
  const setDragState = (patch: Partial<DragState>) => {
    if (Object.prototype.hasOwnProperty.call(patch, "draggingMeta")) {
      draggingMetaRef.current = patch.draggingMeta ?? null;
    }
    setDrag((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    dragStateRef.current = drag;
  }, [drag]);

  const { draggingNodeId, draggingMeta, dragOverNodeId, dragOverZone } = drag;

  const clearDragState = () => {
    setDragState({
      draggingNodeId: null,
      draggingMeta: null,
      dragOverNodeId: null,
      dragOverZone: null,
      pointerX: null,
      pointerY: null,
    });
  };

  const inspectorFormRef = useRef(inspectorForm);
  inspectorFormRef.current = inspectorForm;
  const selectedDetailRef = useRef<DetailedLinkedNode | null | undefined>(undefined);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateKeyRef = useRef<CosplayNodeId | null>(null);

  const searchNeedle = search.trim().toLowerCase();
  const roots = useMemo(
    () =>
      linkedNodes
        .map((node) => ({
          node,
          rootIndex: linkedNodeIds.findIndex((id) => id === node._id),
        }))
        .filter(({ node }) =>
          !searchNeedle
            ? true
            : `${node.name} ${node.category ?? ""} ${node.nodeType} ${formatNodeStatus(node)}`
                .toLowerCase()
                .includes(searchNeedle)
        ),
    [linkedNodes, linkedNodeIds, searchNeedle]
  );

  useEffect(() => {
    if (!roots.length) {
      setSelected(null);
      setSelectedPath([]);
      return;
    }
    setSelected((current) => {
      if (current && roots.some(({ node }) => node._id === current.nodeId)) {
        return current;
      }
      const first = roots[0];
      return first ? { nodeId: first.node._id, isRoot: true, rootIndex: first.rootIndex } : null;
    });
  }, [roots]);

  useEffect(() => {
    if (!selected?.isRoot) return;
    const entry = roots.find(({ node }) => node._id === selected.nodeId);
    if (entry) {
      setSelectedPath([{ meta: selected, label: entry.node.name }]);
    }
  }, [selected, roots]);

  const selectedDetail = useQuery(
    api.cosplayNodes.get,
    selected ? { id: selected.nodeId, buildId } : "skip"
  ) as DetailedLinkedNode | null | undefined;

  selectedDetailRef.current = selectedDetail;

  useEffect(() => {
    hydrateKeyRef.current = null;
  }, [selected?.nodeId]);

  useEffect(() => {
    const nid = selected?.nodeId;
    if (!nid || !selectedDetail || selectedDetail._id !== nid) return;
    if (hydrateKeyRef.current === nid) return;
    hydrateKeyRef.current = nid;
    setInspectorForm({
      name: selectedDetail.name,
      notes: selectedDetail.notes ?? "",
      directCostDollars:
        selectedDetail.directCostCents != null
          ? (selectedDetail.directCostCents / 100).toFixed(2)
          : "",
      elementCombinedStatus: elementCombinedFromDb(
        selectedDetail.purchaseStatus,
        selectedDetail.buildStatus
      ),
      materialStatus: selectedDetail.materialStatus ?? "to_buy",
    });
    setPersistStatus("saved");
  }, [selected?.nodeId, selectedDetail]);

  const formMatchesDetail = useCallback(
    (form: typeof inspectorForm, detail: DetailedLinkedNode) => {
      const directParsed = form.directCostDollars.trim()
        ? Math.round(Number(form.directCostDollars) * 100)
        : null;
      const directOk =
        form.directCostDollars.trim() === "" || !Number.isNaN(directParsed as number);
      const directCents = directOk ? directParsed : detail.directCostCents;
      return (
        form.name.trim() === detail.name &&
        (form.notes.trim() || null) === (detail.notes ?? null) &&
        directCents === (detail.directCostCents ?? null) &&
        (detail.nodeType === "element"
          ? form.elementCombinedStatus ===
            elementCombinedFromDb(detail.purchaseStatus, detail.buildStatus)
          : form.materialStatus === (detail.materialStatus ?? "to_buy"))
      );
    },
    []
  );

  const flushInspectorSave = useCallback(async (): Promise<void> => {
    const detail = selectedDetailRef.current;
    if (!userId || !detail) return;
    const form = inspectorFormRef.current;
    const name = form.name.trim();
    if (!name) return;
    if (formMatchesDetail(form, detail)) {
      setPersistStatus("saved");
      return;
    }
    const directParsed = form.directCostDollars.trim()
      ? Math.round(Number(form.directCostDollars) * 100)
      : null;
    if (form.directCostDollars.trim() !== "" && Number.isNaN(directParsed as number)) return;

    setPersistStatus("saving");
    try {
      const elementFields =
        detail.nodeType === "element" ? dbFromElementCombined(form.elementCombinedStatus) : null;
      await updateNode({
        id: detail._id,
        userId,
        name,
        notes: form.notes.trim() || null,
        directCostCents: form.directCostDollars.trim() === "" ? null : directParsed,
        purchaseStatus: elementFields?.purchaseStatus ?? null,
        buildStatus: elementFields?.buildStatus ?? null,
        materialStatus: detail.nodeType === "material" ? form.materialStatus : null,
      });
      setPersistStatus("saved");
    } catch {
      setPersistStatus("error");
    }
  }, [userId, updateNode, formMatchesDetail]);

  const flushInspectorSaveRef = useRef(flushInspectorSave);
  flushInspectorSaveRef.current = flushInspectorSave;

  const commitSelection = useCallback(async (meta: NodeSelectionMeta, path: PathSegment[]) => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    await flushInspectorSaveRef.current();
    setSelected(meta);
    setSelectedPath(path);
  }, []);

  useEffect(() => {
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!userId || !selectedDetail) return;
    if (formMatchesDetail(inspectorForm, selectedDetail)) {
      setPersistStatus((s) => (s === "dirty" ? "saved" : s));
      return;
    }
    if (!inspectorForm.name.trim()) {
      setPersistStatus("dirty");
      return;
    }
    setPersistStatus("dirty");
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      void flushInspectorSaveRef.current();
    }, 500);
    return () => {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
      }
    };
  }, [inspectorForm, selectedDetail, userId, formMatchesDetail]);

  const unlinkSelected = async () => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    await flushInspectorSaveRef.current();
    if (!userId || !selected) return;
    if (selected.isRoot) {
      await removeNodeFromBuild({ userId, buildId, cosplayNodeId: selected.nodeId });
      return;
    }
    const linkId = selected.siblingLinkIds?.[selected.siblingIndex ?? -1];
    if (!linkId) return;
    await removeChildLink({ userId, id: linkId });
  };

  const moveNodeIntoTarget = async (dragged: NodeSelectionMeta, targetNodeId: CosplayNodeId) => {
    if (!userId || dragged.nodeId === targetNodeId) return;
    const draggedNode = allNodes.find((node) => node._id === dragged.nodeId);
    const targetNode = allNodes.find((node) => node._id === targetNodeId);
    if (!draggedNode || !targetNode) return;
    if (!isAllowedChildLink(targetNode.nodeType, draggedNode.nodeType)) {
      setGraphError("That relationship is not allowed.");
      return;
    }
    if (dragged.isRoot) {
      await removeNodeFromBuild({ userId, buildId, cosplayNodeId: dragged.nodeId });
    } else {
      const linkId = dragged.siblingLinkIds?.[dragged.siblingIndex ?? -1];
      if (!linkId) return;
      await removeChildLink({ userId, id: linkId });
    }
    await addChildLink({
      userId,
      parentNodeId: targetNodeId,
      childNodeId: dragged.nodeId,
      linkMode: "owned",
    });
    setGraphError(null);
  };

  const handleDropOnNode = async (
    dragged: NodeSelectionMeta,
    target: NodeSelectionMeta,
    zone: DropZone
  ) => {
    if (!userId || dragged.nodeId === target.nodeId) return;
    const draggedNode = allNodes.find((n) => n._id === dragged.nodeId);
    const targetNode = allNodes.find((n) => n._id === target.nodeId);
    if (!draggedNode || !targetNode) return;
    if (zone === "into") {
      await moveNodeIntoTarget(dragged, target.nodeId);
      return;
    }
    if (!canReorderAsSiblings(dragged, target)) return;
    if (dragged.isRoot && target.isRoot) {
      const from = dragged.rootIndex ?? -1;
      const to = target.rootIndex ?? -1;
      if (from < 0 || to < 0 || from === to) return;
      const ids = [...linkedNodeIds];
      const next = zone === "before" ? moveBefore(ids, from, to) : moveAfter(ids, from, to);
      await linkNodes({ userId, buildId, cosplayNodeIds: next });
      return;
    }
    if (!dragged.isRoot && !target.isRoot && dragged.parentNodeId === target.parentNodeId) {
      const parentId = dragged.parentNodeId;
      if (!parentId) return;
      const order = [...(dragged.siblingLinkIds ?? [])];
      const from = dragged.siblingIndex ?? -1;
      const to = target.siblingIndex ?? -1;
      if (from < 0 || to < 0 || from === to) return;
      const next = zone === "before" ? moveBefore(order, from, to) : moveAfter(order, from, to);
      await reorderChildren({ parentNodeId: parentId, userId, orderedLinkIds: next });
    }
  };

  const promoteNodeToRoot = async (dragged: NodeSelectionMeta) => {
    if (!userId || dragged.isRoot) return;
    const linkId = dragged.siblingLinkIds?.[dragged.siblingIndex ?? -1];
    if (!linkId) return;
    await removeChildLink({ userId, id: linkId });
    await linkNodes({
      userId,
      buildId,
      cosplayNodeIds: [...linkedNodeIds, dragged.nodeId],
    });
    const newMeta = { nodeId: dragged.nodeId, isRoot: true, rootIndex: linkedNodeIds.length };
    const node = allNodes.find((n) => n._id === dragged.nodeId);
    void commitSelection(newMeta, [{ meta: newMeta, label: node?.name ?? "Node" }]);
    setGraphError(null);
  };

  const selectBuildRoot = () => {
    const first = roots[0];
    if (!first) return;
    const meta = { nodeId: first.node._id, isRoot: true, rootIndex: first.rootIndex };
    void commitSelection(meta, [{ meta, label: first.node.name }]);
  };

  useEffect(() => {
    if (!draggingMeta || typeof window === "undefined" || typeof document === "undefined") return;

    const resolvePointerTarget = (clientX: number, clientY: number) => {
      const rootZone = document.querySelector("[data-root-drop-zone='true']") as HTMLElement | null;
      if (rootZone && pointInsideRect(clientX, clientY, rootZone.getBoundingClientRect())) {
        return {
          dragOverNodeId: "__root__" as const,
          dragOverZone: null,
          targetMeta: null,
        };
      }

      const rows = Array.from(document.querySelectorAll("[data-node-drop-id]")) as HTMLElement[];

      let row: HTMLElement | null = null;
      let fallbackRow: HTMLElement | null = null;
      let fallbackDistance = Number.POSITIVE_INFINITY;

      for (const candidate of rows) {
        const rect = candidate.getBoundingClientRect();
        if (pointInsideRect(clientX, clientY, rect)) {
          row = candidate;
          break;
        }
        const withinHorizontalReach = clientX >= rect.left - 40 && clientX <= rect.right + 40;
        if (!withinHorizontalReach) continue;
        const verticalDistance =
          clientY < rect.top
            ? rect.top - clientY
            : clientY > rect.bottom
              ? clientY - rect.bottom
              : 0;
        if (verticalDistance < fallbackDistance) {
          fallbackDistance = verticalDistance;
          fallbackRow = candidate;
        }
      }

      if (!row && fallbackDistance <= 20) {
        row = fallbackRow;
      }

      if (!row) {
        return {
          dragOverNodeId: null,
          dragOverZone: null,
          targetMeta: null,
        };
      }

      const targetMeta = parseSelectionMeta(row.dataset.nodeDropMeta);
      if (!targetMeta) {
        return {
          dragOverNodeId: null,
          dragOverZone: null,
          targetMeta: null,
        };
      }

      const draggedNode = allNodes.find((node) => node._id === draggingMeta.nodeId);
      const targetNode = allNodes.find((node) => node._id === targetMeta.nodeId);
      const zone = computeDropZone(
        clientY,
        row.getBoundingClientRect(),
        draggingMeta,
        targetMeta,
        draggedNode,
        targetNode
      );

      return {
        dragOverNodeId: zone ? targetMeta.nodeId : null,
        dragOverZone: zone,
        targetMeta,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const resolved = resolvePointerTarget(event.clientX, event.clientY);
      setDragState({
        pointerX: event.clientX,
        pointerY: event.clientY,
        dragOverNodeId: resolved.dragOverNodeId,
        dragOverZone: resolved.dragOverZone,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      const activeMeta = currentDrag.draggingMeta ?? draggingMetaRef.current;
      if (!activeMeta) {
        clearDragState();
        return;
      }
      const resolved = resolvePointerTarget(event.clientX, event.clientY);
      clearDragState();
      if (resolved.dragOverNodeId === "__root__") {
        void promoteNodeToRoot(activeMeta);
        return;
      }
      if (resolved.targetMeta && resolved.dragOverZone) {
        void handleDropOnNode(activeMeta, resolved.targetMeta, resolved.dragOverZone);
      }
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: true, once: true });

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [allNodes, draggingMeta]);

  return (
    <div className="space-y-4">
      {roots.length === 0 ? (
        <div className="border border-dashed border-kyar-borderSubtle bg-kyar-surface px-5 py-10 text-sm text-kyar-textTertiary">
          No linked nodes yet. Create a root node or link an existing element or material to start
          building the structure for this project.
        </div>
      ) : (
        <div className="border border-kyar-borderSubtle bg-kyar-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-kyar-borderSubtle bg-kyar-bg px-4 py-3">
            <div>
              <p className="font-serif text-lg font-semibold tracking-tight text-kyar-text">
                Build explorer
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                Drag the ⋮⋮ handle · top/bottom reorder · middle nests · strip promotes to root
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCreateRoot}
                className="inline-flex items-center gap-1.5 rounded-md border border-kyar-text bg-kyar-text px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-kyar-bg"
              >
                <span className="material-symbols-outlined text-base">create_new_folder</span>
                New root
              </button>
              <button
                type="button"
                onClick={onOpenLinkNodes}
                className="inline-flex items-center gap-1.5 rounded-md border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-kyar-text"
              >
                <span className="material-symbols-outlined text-base">link</span>
                Link existing
              </button>
            </div>
          </div>

          <div
            role="navigation"
            aria-label="Selection path"
            className="font-explorer-mono flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-kyar-borderSubtle bg-[linear-gradient(180deg,rgba(0,0,0,0.02),transparent)] px-3 py-2 text-[11px] text-kyar-textSecondary"
          >
            <button
              type="button"
              onClick={selectBuildRoot}
              className="max-w-[40%] truncate rounded px-1.5 py-0.5 text-left hover:bg-kyar-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-text/30"
              title={buildName}
            >
              {buildName}
            </button>
            {selectedPath.map((seg, index) => (
              <span key={`${seg.meta.nodeId}-${index}`} className="flex min-w-0 items-center gap-1">
                <span className="text-kyar-textTertiary" aria-hidden>
                  /
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void commitSelection(
                      seg.meta,
                      selectedPath.slice(0, index + 1) as PathSegment[]
                    )
                  }
                  className="max-w-[min(100%,12rem)] truncate rounded px-1.5 py-0.5 text-left hover:bg-kyar-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-text/30"
                >
                  {seg.label}
                </button>
              </span>
            ))}
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)] xl:divide-x xl:divide-kyar-borderSubtle">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-kyar-borderSubtle px-3 py-2">
                <span className="material-symbols-outlined text-kyar-textTertiary" aria-hidden>
                  search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter by name, type, status…"
                  className="font-explorer-mono min-w-[180px] flex-1 border-0 bg-transparent text-[12px] placeholder:text-kyar-textTertiary focus:outline-none"
                  aria-label="Filter linked nodes"
                />
              </div>

              <div className="hidden border-b border-kyar-borderSubtle px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-kyar-textTertiary sm:grid sm:grid-cols-[56px_48px_minmax(0,1fr)_72px_72px_64px_52px] sm:gap-2">
                <span className="sr-only">Drag and expand</span>
                <span className="sr-only">Image</span>
                <span className="pl-1">Name</span>
                <span className="text-right sm:text-left">Type</span>
                <span>Status</span>
                <span className="text-right">Cost</span>
                <span className="text-right"> </span>
              </div>

              <div className="max-h-[min(640px,78vh)] overflow-y-auto px-1 py-2">
                {draggingNodeId ? (
                  <button
                    type="button"
                    data-root-drop-zone="true"
                    className={`font-explorer-mono mb-3 flex w-full items-center justify-center border border-dashed px-3 py-2.5 text-[10px] uppercase tracking-widest transition ${
                      dragOverNodeId === "__root__"
                        ? "border-kyar-text bg-kyar-text text-kyar-bg"
                        : "border-kyar-borderSubtle text-kyar-textTertiary"
                    }`}
                  >
                    {dragOverNodeId === "__root__" && draggingMeta
                      ? "Release to promote to root"
                      : "Drop to promote to root"}
                  </button>
                ) : null}
                <div className="space-y-0.5">
                  {roots.map(({ node, rootIndex }) => (
                    <BuildNodeManagerRow
                      key={node._id}
                      buildId={buildId}
                      node={node}
                      userId={userId}
                      allNodes={allNodes}
                      isSelected={selected?.nodeId === node._id}
                      selectedNodeId={selected?.nodeId ?? null}
                      pathPrefix={[]}
                      selectionMeta={{ nodeId: node._id, isRoot: true, rootIndex }}
                      onSelect={(meta, path) => void commitSelection(meta, path)}
                      onCreateChild={onCreateChild}
                      onDropOnNode={handleDropOnNode}
                      draggingNodeId={draggingNodeId}
                      draggingMeta={draggingMeta}
                      draggingMetaRef={draggingMetaRef}
                      treeDragOverNodeId={dragOverNodeId}
                      treeDragOverZone={dragOverZone}
                      onDragStateChange={setDragState}
                    />
                  ))}
                </div>
              </div>

              <div
                className="font-explorer-mono flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-kyar-borderSubtle bg-kyar-bg px-3 py-2 text-[10px] text-kyar-textSecondary"
                role="status"
              >
                <span>
                  {searchNeedle
                    ? `${roots.length} match${roots.length === 1 ? "" : "es"}`
                    : `${roots.length} root${roots.length === 1 ? "" : "s"} at this level`}
                </span>
                {searchNeedle ? (
                  <span className="text-kyar-textTertiary">
                    Filter: &quot;{search.trim()}&quot;
                  </span>
                ) : null}
                <span className="min-w-0 truncate">
                  {selectedDetail
                    ? `Selected: ${selectedDetail.name}`
                    : selected
                      ? "Selected"
                      : "Nothing selected"}
                </span>
              </div>
            </div>

            <div className="min-w-0 border-t border-kyar-borderSubtle bg-kyar-surface p-5 xl:border-t-0">
              {selectedDetail ? (
                <div className="space-y-5">
                  <div className="border-b border-kyar-borderSubtle pb-4">
                    <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                      Properties
                    </p>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <NodeThumb node={selectedDetail} detail={selectedDetail} />
                        <div className="min-w-0 flex-1">
                          <label className="sr-only" htmlFor="explorer-node-title">
                            Name
                          </label>
                          <input
                            id="explorer-node-title"
                            value={inspectorForm.name}
                            onChange={(event) =>
                              setInspectorForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            onBlur={() => void flushInspectorSaveRef.current()}
                            aria-invalid={!inspectorForm.name.trim()}
                            className={`font-serif w-full border-b border-transparent bg-transparent text-2xl text-kyar-text focus:border-kyar-text focus:outline-none ${
                              !inspectorForm.name.trim() ? "border-red-500 text-red-700" : ""
                            }`}
                          />
                          {!inspectorForm.name.trim() ? (
                            <p className="mt-1 text-xs text-red-600">Name is required</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                            <span>{formatNodeTypeLabel(selectedDetail.nodeType)}</span>
                            <span>
                              {visibleBucket(selectedDetail.overallBucket) === "complete"
                                ? "Complete"
                                : "In progress"}
                            </span>
                            <span>{selectedDetail.progressPercent ?? 0}% progress</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className="text-[10px] uppercase tracking-widest text-kyar-textTertiary"
                          aria-live="polite"
                        >
                          {persistStatus === "saving" ? "Saving…" : null}
                          {persistStatus === "dirty" ? "Unsaved" : null}
                          {persistStatus === "saved" ? "Saved" : null}
                          {persistStatus === "error" ? "Save failed" : null}
                        </span>
                        <Link
                          href={`/elements/${selectedDetail._id}`}
                          className="rounded-full border border-kyar-borderSubtle px-3 py-2 text-[10px] uppercase tracking-widest"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <label className="space-y-2">
                      <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                        Direct cost
                      </span>
                      <input
                        value={inspectorForm.directCostDollars}
                        onChange={(event) =>
                          setInspectorForm((current) => ({
                            ...current,
                            directCostDollars: event.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                      />
                    </label>
                    <div className="rounded-2xl border border-kyar-borderSubtle px-4 py-3">
                      <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                        Rollup cost
                      </p>
                      <p className="mt-2 text-lg font-medium text-kyar-text">
                        {selectedDetail.totalCostCents != null
                          ? formatCents(selectedDetail.totalCostCents)
                          : "—"}
                      </p>
                    </div>
                    {selectedDetail.nodeType === "element" ? (
                      <label className="col-span-2 space-y-2">
                        <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                          Status
                        </span>
                        <select
                          value={inspectorForm.elementCombinedStatus}
                          onChange={(event) =>
                            setInspectorForm((current) => ({
                              ...current,
                              elementCombinedStatus: event.target.value as ElementCombinedStatus,
                            }))
                          }
                          className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                        >
                          {ELEMENT_COMBINED_OPTIONS.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="col-span-2 space-y-2">
                        <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                          Material status
                        </span>
                        <select
                          value={inspectorForm.materialStatus}
                          onChange={(event) =>
                            setInspectorForm((current) => ({
                              ...current,
                              materialStatus: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                        >
                          <option value="to_buy">To buy</option>
                          <option value="bought">Bought</option>
                          <option value="in_use">In use</option>
                          <option value="complete">Complete</option>
                        </select>
                      </label>
                    )}
                    <label className="col-span-2 space-y-2">
                      <span className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">
                        Notes
                      </span>
                      <textarea
                        value={inspectorForm.notes}
                        onChange={(event) =>
                          setInspectorForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        rows={4}
                        className="w-full rounded-2xl border border-kyar-borderSubtle bg-transparent px-4 py-3 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        onCreateChild(
                          selectedDetail._id,
                          selectedDetail.nodeType === "material" ? "material" : "element"
                        )
                      }
                      className="rounded-full border border-kyar-text px-4 py-3 text-[10px] uppercase tracking-widest text-kyar-text"
                    >
                      New child
                    </button>
                    <button
                      type="button"
                      onClick={() => void unlinkSelected()}
                      className="rounded-full border border-kyar-borderSubtle px-4 py-3 text-[10px] uppercase tracking-widest"
                    >
                      {selected?.isRoot ? "Unlink root" : "Unlink child"}
                    </button>
                  </div>

                  {graphError ? (
                    <p className="text-xs text-red-600" role="alert">
                      {graphError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-kyar-textTertiary">
                  Select a node in the tree to edit properties.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {draggingMeta && draggingNodeId && drag.pointerX != null && drag.pointerY != null ? (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[80] w-[min(420px,calc(100vw-32px))]"
          style={{
            transform: `translate(${Math.min(drag.pointerX + 16, window.innerWidth - 440)}px, ${Math.min(
              drag.pointerY + 16,
              window.innerHeight - 120
            )}px)`,
          }}
        >
          <DragPreviewRow
            node={allNodes.find((node) => node._id === draggingMeta.nodeId) ?? linkedNodes[0]}
            variant="floating"
            label={
              dragOverNodeId === "__root__"
                ? "Promote to root"
                : dragOverZone === "before"
                  ? "Reorder before"
                  : dragOverZone === "after"
                    ? "Reorder after"
                    : dragOverZone === "into"
                      ? "Nest inside"
                      : "Move node"
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function BuildNodeManagerRow({
  buildId,
  node,
  userId,
  allNodes,
  isSelected,
  selectedNodeId,
  pathPrefix,
  selectionMeta,
  onSelect,
  onCreateChild,
  onDropOnNode,
  draggingNodeId,
  draggingMeta,
  draggingMetaRef,
  treeDragOverNodeId,
  treeDragOverZone,
  onDragStateChange,
}: {
  buildId: Id<"builds">;
  node: BuildNodeManagerLinkedNode;
  userId: string | null;
  allNodes: BuildNodeManagerLinkedNode[];
  isSelected: boolean;
  selectedNodeId: CosplayNodeId | null;
  pathPrefix: PathSegment[];
  selectionMeta: NodeSelectionMeta;
  onSelect: (meta: NodeSelectionMeta, path: PathSegment[]) => void | Promise<void>;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
  onDropOnNode: (
    dragged: NodeSelectionMeta,
    target: NodeSelectionMeta,
    zone: DropZone
  ) => Promise<void>;
  draggingNodeId: CosplayNodeId | null;
  draggingMeta: NodeSelectionMeta | null;
  draggingMetaRef: MutableRefObject<NodeSelectionMeta | null>;
  treeDragOverNodeId: CosplayNodeId | "__root__" | null;
  treeDragOverZone: DropZone | null;
  onDragStateChange: (state: Partial<DragState>) => void;
}) {
  const detail = useQuery(api.cosplayNodes.get, { id: node._id, buildId }) as
    | DetailedLinkedNode
    | null
    | undefined;
  const [expanded, setExpanded] = useState(selectionMeta.isRoot);
  const children = detail?.children ?? [];

  const isDragging = draggingNodeId === node._id;
  const activeDropZone = treeDragOverNodeId === node._id ? treeDragOverZone : null;

  const displayName = detail?.name ?? node.name;
  const nodePath: PathSegment[] = [...pathPrefix, { meta: selectionMeta, label: displayName }];
  const showChildren = expanded && children.length > 0;

  return (
    <div className="space-y-0.5">
      <div
        data-node-drop-id={node._id}
        data-node-drop-meta={JSON.stringify(selectionMeta)}
        className={`rounded-md border transition ${
          isSelected
            ? "border-kyar-text bg-kyar-bg"
            : "border-transparent hover:border-kyar-borderSubtle hover:bg-kyar-text/5"
        } ${
          activeDropZone === "before"
            ? "border-t-2 border-t-kyar-text"
            : activeDropZone === "after"
              ? "border-b-2 border-b-kyar-text"
              : activeDropZone === "into"
                ? "border-kyar-text bg-kyar-text/5 ring-1 ring-kyar-text/40"
                : ""
        } ${isDragging ? "opacity-45" : ""}`}
      >
        <div className="grid grid-cols-1 items-start gap-x-2 px-1 py-2.5 sm:grid-cols-[56px_48px_minmax(0,1fr)_72px_72px_64px_52px] sm:items-center">
          <div className="row-start-1 flex items-center gap-0.5 sm:mt-0">
            {userId ? (
              <div
                onPointerDown={(event) => {
                  if (!userId || event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onDragStateChange({
                    draggingNodeId: node._id,
                    draggingMeta: selectionMeta,
                    dragOverNodeId: null,
                    dragOverZone: null,
                    pointerX: event.clientX,
                    pointerY: event.clientY,
                  });
                }}
                className="flex h-11 min-w-[32px] shrink-0 cursor-grab touch-none select-none items-center justify-center rounded text-kyar-textTertiary active:cursor-grabbing"
                aria-label={`Drag to reorder or reparent ${displayName}`}
                title="Drag to reorder or reparent"
              >
                <span className="material-symbols-outlined pointer-events-none text-lg" aria-hidden>
                  drag_indicator
                </span>
              </div>
            ) : (
              <span className="h-11 w-7 shrink-0" aria-hidden />
            )}
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-kyar-textTertiary"
              aria-expanded={children.length ? expanded : undefined}
              aria-label={children.length ? (expanded ? "Collapse" : "Expand") : "Leaf"}
            >
              <span className="material-symbols-outlined text-lg">
                {children.length
                  ? expanded
                    ? "expand_more"
                    : "chevron_right"
                  : "fiber_manual_record"}
              </span>
            </button>
          </div>
          <div className="row-start-2 flex justify-center sm:row-start-1">
            <NodeThumb node={node} detail={detail} />
          </div>
          <button
            type="button"
            onClick={() => onSelect(selectionMeta, nodePath)}
            className="row-start-2 min-w-0 text-left sm:col-span-1 sm:row-start-1 sm:col-start-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium text-kyar-text">{displayName}</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onSelect(selectionMeta, nodePath)}
            className="hidden text-[10px] uppercase tracking-wider text-kyar-textSecondary sm:col-start-4 sm:block sm:text-left"
          >
            {formatNodeTypeLabel(detail?.nodeType ?? node.nodeType)}
          </button>
          <button
            type="button"
            onClick={() => onSelect(selectionMeta, nodePath)}
            className="hidden truncate text-[10px] uppercase tracking-wider text-kyar-textSecondary sm:col-start-5 sm:block"
          >
            {formatNodeStatus(detail ?? node)}
          </button>
          <button
            type="button"
            onClick={() => onSelect(selectionMeta, nodePath)}
            className="hidden text-right text-[10px] tabular-nums text-kyar-textSecondary sm:col-start-6 sm:block"
          >
            {detail?.totalCostCents != null
              ? formatCents(detail.totalCostCents)
              : node.totalCostCents != null
                ? formatCents(node.totalCostCents)
                : "—"}
          </button>
          {userId ? (
            <button
              type="button"
              onClick={() =>
                onCreateChild(
                  node._id,
                  (detail?.nodeType ?? node.nodeType) === "material" ? "material" : "element"
                )
              }
              className="row-start-2 justify-self-end rounded-md border border-kyar-borderSubtle px-2 py-1 text-[9px] uppercase tracking-widest sm:col-start-7 sm:row-start-1"
            >
              Add
            </button>
          ) : (
            <span className="hidden sm:col-start-7 sm:block" />
          )}
        </div>
        <div className="px-3 pb-2 sm:hidden">
          <button
            type="button"
            onClick={() => onSelect(selectionMeta, nodePath)}
            className="text-[10px] uppercase tracking-wider text-kyar-textTertiary"
          >
            {formatNodeTypeLabel(detail?.nodeType ?? node.nodeType)} ·{" "}
            {formatNodeStatus(detail ?? node)} ·{" "}
            {detail?.progressPercent ?? node.progressPercent ?? 0}%
          </button>
        </div>
        {activeDropZone && draggingNodeId !== node._id ? (
          <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-kyar-textTertiary">
            {activeDropZone === "before" && `Drop before ${displayName}`}
            {activeDropZone === "after" && `Drop after ${displayName}`}
            {activeDropZone === "into" && `Nest under ${displayName}`}
          </div>
        ) : null}
      </div>
      {showChildren ? (
        <div className="ml-4 border-l border-kyar-borderSubtle pl-2">
          {children.map((child, index) => (
            <BuildNodeManagerRow
              key={child._id}
              buildId={buildId}
              node={child}
              userId={userId}
              allNodes={allNodes}
              isSelected={selectedNodeId === child._id}
              selectedNodeId={selectedNodeId}
              pathPrefix={nodePath}
              selectionMeta={{
                nodeId: child._id,
                isRoot: false,
                parentNodeId: node._id,
                siblingLinkIds: children.map((entry) => entry.linkId),
                siblingIndex: index,
              }}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onDropOnNode={onDropOnNode}
              draggingNodeId={draggingNodeId}
              draggingMeta={draggingMeta}
              draggingMetaRef={draggingMetaRef}
              treeDragOverNodeId={treeDragOverNodeId}
              treeDragOverZone={treeDragOverZone}
              onDragStateChange={onDragStateChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
