"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type {
  CosplayNodeId,
  DragState,
  DropZone,
  ExplorerLinkedNode,
  NodeSelectionMeta,
  PathSegment,
} from "./types";
import {
  canReorderAsSiblings,
  computeDropZone,
  isAllowedChildLink,
  moveAfter,
  moveBefore,
  parseSelectionMeta,
  pointInsideRect,
} from "./types";

type UseExplorerDragOpts = {
  buildId: Id<"builds">;
  userId: string | null;
  linkedNodeIds: CosplayNodeId[];
  allNodes: ExplorerLinkedNode[];
  commitSelection: (meta: NodeSelectionMeta, path: PathSegment[]) => Promise<void>;
};

export function useExplorerDrag({
  buildId,
  userId,
  linkedNodeIds,
  allNodes,
  commitSelection,
}: UseExplorerDragOpts) {
  const linkNodes = useMutation(api.builds.linkNodes);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);

  const [drag, setDrag] = useState<DragState>({
    draggingNodeId: null,
    draggingMeta: null,
    dragOverNodeId: null,
    dragOverZone: null,
    pointerX: null,
    pointerY: null,
  });
  const [graphError, setGraphError] = useState<string | null>(null);

  const draggingMetaRef = useRef<NodeSelectionMeta | null>(null);
  const dragStateRef = useRef<DragState>(drag);

  const setDragState = useCallback((patch: Partial<DragState>) => {
    if (Object.prototype.hasOwnProperty.call(patch, "draggingMeta")) {
      draggingMetaRef.current = patch.draggingMeta ?? null;
    }
    setDrag((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    dragStateRef.current = drag;
  }, [drag]);

  const clearDragState = useCallback(() => {
    setDragState({
      draggingNodeId: null,
      draggingMeta: null,
      dragOverNodeId: null,
      dragOverZone: null,
      pointerX: null,
      pointerY: null,
    });
  }, [setDragState]);

  const moveNodeIntoTarget = useCallback(
    async (dragged: NodeSelectionMeta, targetNodeId: CosplayNodeId) => {
      if (!userId || dragged.nodeId === targetNodeId) return;
      const draggedNode = allNodes.find((n) => n._id === dragged.nodeId);
      const targetNode = allNodes.find((n) => n._id === targetNodeId);
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
    },
    [userId, buildId, allNodes, removeNodeFromBuild, removeChildLink, addChildLink]
  );

  const handleDropOnNode = useCallback(
    async (dragged: NodeSelectionMeta, target: NodeSelectionMeta, zone: DropZone) => {
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
    },
    [userId, buildId, allNodes, linkedNodeIds, moveNodeIntoTarget, linkNodes, reorderChildren]
  );

  const promoteNodeToRoot = useCallback(
    async (dragged: NodeSelectionMeta) => {
      if (!userId || dragged.isRoot) return;
      const linkId = dragged.siblingLinkIds?.[dragged.siblingIndex ?? -1];
      if (!linkId) return;
      await removeChildLink({ userId, id: linkId });
      await linkNodes({
        userId,
        buildId,
        cosplayNodeIds: [...linkedNodeIds, dragged.nodeId],
      });
      const newMeta: NodeSelectionMeta = {
        nodeId: dragged.nodeId,
        isRoot: true,
        rootIndex: linkedNodeIds.length,
      };
      const node = allNodes.find((n) => n._id === dragged.nodeId);
      void commitSelection(newMeta, [{ meta: newMeta, label: node?.name ?? "Node" }]);
      setGraphError(null);
    },
    [userId, buildId, linkedNodeIds, allNodes, removeChildLink, linkNodes, commitSelection]
  );

  // Global pointer listeners while dragging
  useEffect(() => {
    const activeMeta = drag.draggingMeta;
    if (!activeMeta || typeof window === "undefined" || typeof document === "undefined") return;

    const resolvePointerTarget = (clientX: number, clientY: number) => {
      const rootZone = document.querySelector("[data-root-drop-zone='true']") as HTMLElement | null;
      if (rootZone && pointInsideRect(clientX, clientY, rootZone.getBoundingClientRect())) {
        return { dragOverNodeId: "__root__" as const, dragOverZone: null, targetMeta: null };
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

      if (!row && fallbackDistance <= 20) row = fallbackRow;
      if (!row) return { dragOverNodeId: null, dragOverZone: null, targetMeta: null };

      const targetMeta = parseSelectionMeta(row.dataset.nodeDropMeta);
      if (!targetMeta) return { dragOverNodeId: null, dragOverZone: null, targetMeta: null };

      const draggedNode = allNodes.find((n) => n._id === activeMeta.nodeId);
      const targetNode = allNodes.find((n) => n._id === targetMeta.nodeId);
      const zone = computeDropZone(
        clientY,
        row.getBoundingClientRect(),
        activeMeta,
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
      const meta = currentDrag.draggingMeta ?? draggingMetaRef.current;
      if (!meta) {
        clearDragState();
        return;
      }
      const resolved = resolvePointerTarget(event.clientX, event.clientY);
      clearDragState();
      if (resolved.dragOverNodeId === "__root__") {
        void promoteNodeToRoot(meta);
        return;
      }
      if (resolved.targetMeta && resolved.dragOverZone) {
        void handleDropOnNode(meta, resolved.targetMeta, resolved.dragOverZone);
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
  }, [
    allNodes,
    drag.draggingMeta,
    setDragState,
    clearDragState,
    promoteNodeToRoot,
    handleDropOnNode,
  ]);

  return {
    drag,
    graphError,
    setGraphError,
    setDragState,
    clearDragState,
    handleDropOnNode,
    promoteNodeToRoot,
    moveNodeIntoTarget,
  };
}
