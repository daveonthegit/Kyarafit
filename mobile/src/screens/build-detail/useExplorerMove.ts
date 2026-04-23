import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  canReorderAsSiblings,
  computeDropZone,
  isAllowedChildLink,
  moveAfter,
  moveBefore,
  pointInsideRect,
  type DropZone,
} from "@kyarafit/design-system/domain";
import type { NodeSelectionMeta } from "./useNodeInspector";

type NodeType = "element" | "material";

type DragMeta = NodeSelectionMeta & {
  name: string;
  nodeType: NodeType;
};

type RectLike = {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
};

type RegisteredRow = {
  ref: {
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  } | null;
  meta: DragMeta;
};

type DropTarget =
  | {
      nodeId: Id<"cosplayNodes">;
      zone: DropZone;
    }
  | {
      nodeId: "__root__";
      zone: null;
    }
  | null;

type UseExplorerMoveOpts = {
  buildId: Id<"builds">;
  userId: string | null;
  rootOrderIds: Id<"cosplayNodes">[];
  setRootOrderIds: (ids: Id<"cosplayNodes">[]) => void;
  onError: (message: string) => void;
};

function measureView(
  view: {
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  } | null
) {
  return new Promise<RectLike | null>((resolve) => {
    if (!view?.measureInWindow) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => {
      resolve({
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        height,
      });
    });
  });
}

export function useExplorerMove({
  buildId,
  userId,
  rootOrderIds,
  setRootOrderIds,
  onError,
}: UseExplorerMoveOpts) {
  const reorderRoots = useMutation(api.builds.reorderRootLinks);
  const linkNodes = useMutation(api.builds.linkNodes);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);

  const rowRegistryRef = useRef(new Map<string, RegisteredRow>());
  const rowRectsRef = useRef(new Map<string, RectLike>());
  const rootDropRef = useRef<{
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  } | null>(null);
  const rootDropRectRef = useRef<RectLike | null>(null);

  const [dragging, setDragging] = useState<{
    meta: DragMeta | null;
    point: { x: number; y: number } | null;
    target: DropTarget;
    busy: boolean;
  }>({
    meta: null,
    point: null,
    target: null,
    busy: false,
  });

  const registerRow = useCallback(
    (
      nodeId: Id<"cosplayNodes">,
      ref: {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null,
      meta: DragMeta
    ) => {
      rowRegistryRef.current.set(nodeId as string, { ref, meta });
    },
    []
  );

  const unregisterRow = useCallback((nodeId: Id<"cosplayNodes">) => {
    rowRegistryRef.current.delete(nodeId as string);
    rowRectsRef.current.delete(nodeId as string);
  }, []);

  const registerRootDropZone = useCallback(
    (
      ref: {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null
    ) => {
      rootDropRef.current = ref;
    },
    []
  );

  const measureTargets = useCallback(async () => {
    const entries = Array.from(rowRegistryRef.current.entries());
    const measured = await Promise.all(
      entries.map(async ([key, value]) => [key, await measureView(value.ref)] as const)
    );
    rowRectsRef.current = new Map(
      measured.filter((entry): entry is [string, RectLike] => entry[1] !== null)
    );
    rootDropRectRef.current = await measureView(rootDropRef.current);
  }, []);

  const resolveTarget = useCallback((x: number, y: number, dragMeta: DragMeta): DropTarget => {
    const rootRect = rootDropRectRef.current;
    if (rootRect && pointInsideRect(x, y, rootRect)) {
      return { nodeId: "__root__", zone: null };
    }

    const candidates = Array.from(rowRectsRef.current.entries());
    let match: [string, RectLike] | null = null;
    let fallback: [string, RectLike] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const entry of candidates) {
      const [, rect] = entry;
      if (pointInsideRect(x, y, rect)) {
        match = entry;
        break;
      }
      const withinHorizontalReach = x >= rect.left - 36 && x <= rect.right + 36;
      if (!withinHorizontalReach) continue;
      const verticalDistance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      if (verticalDistance < bestDistance) {
        bestDistance = verticalDistance;
        fallback = entry;
      }
    }

    const chosen = match ?? (bestDistance <= 18 ? fallback : null);
    if (!chosen) return null;

    const [nodeId, rect] = chosen;
    const targetRow = rowRegistryRef.current.get(nodeId);
    if (!targetRow) return null;

    const zone = computeDropZone(
      y,
      rect,
      dragMeta,
      targetRow.meta,
      { nodeType: dragMeta.nodeType },
      { nodeType: targetRow.meta.nodeType }
    );

    if (!zone) return null;
    return { nodeId: targetRow.meta.nodeId, zone };
  }, []);

  const clearDrag = useCallback(() => {
    setDragging({ meta: null, point: null, target: null, busy: false });
  }, []);

  const moveNodeIntoTarget = useCallback(
    async (dragMeta: DragMeta, targetMeta: DragMeta) => {
      if (!userId || dragMeta.nodeId === targetMeta.nodeId) return;
      if (!isAllowedChildLink(targetMeta.nodeType, dragMeta.nodeType)) return;

      if (dragMeta.isRoot) {
        await removeNodeFromBuild({ userId, buildId, cosplayNodeId: dragMeta.nodeId });
        setRootOrderIds(rootOrderIds.filter((id) => id !== dragMeta.nodeId));
      } else {
        const linkId = dragMeta.siblingLinkIds?.[dragMeta.siblingIndex ?? -1];
        if (!linkId) return;
        await removeChildLink({ userId, id: linkId });
      }

      await addChildLink({
        userId,
        parentNodeId: targetMeta.nodeId,
        childNodeId: dragMeta.nodeId,
        linkMode: "owned",
      });
    },
    [
      addChildLink,
      buildId,
      removeChildLink,
      removeNodeFromBuild,
      rootOrderIds,
      setRootOrderIds,
      userId,
    ]
  );

  const commitDrop = useCallback(
    async (target: DropTarget, dragMeta: DragMeta) => {
      if (!userId || !target) return;

      if (target.nodeId === "__root__") {
        if (dragMeta.isRoot) return;
        const linkId = dragMeta.siblingLinkIds?.[dragMeta.siblingIndex ?? -1];
        if (!linkId) return;
        await removeChildLink({ userId, id: linkId });
        const nextRootIds = [...rootOrderIds, dragMeta.nodeId];
        setRootOrderIds(nextRootIds);
        await linkNodes({
          userId,
          buildId,
          cosplayNodeIds: nextRootIds,
        });
        return;
      }

      const targetRow = rowRegistryRef.current.get(target.nodeId as string);
      if (!targetRow || dragMeta.nodeId === targetRow.meta.nodeId) return;

      if (target.zone === "into") {
        await moveNodeIntoTarget(dragMeta, targetRow.meta);
        return;
      }

      if (!canReorderAsSiblings(dragMeta, targetRow.meta)) return;

      if (dragMeta.isRoot && targetRow.meta.isRoot) {
        const from = dragMeta.rootIndex ?? -1;
        const to = targetRow.meta.rootIndex ?? -1;
        if (from < 0 || to < 0 || from === to) return;
        const nextRootIds =
          target.zone === "before"
            ? moveBefore(rootOrderIds, from, to)
            : moveAfter(rootOrderIds, from, to);
        setRootOrderIds(nextRootIds);
        await reorderRoots({ userId, buildId, orderedCosplayNodeIds: nextRootIds });
        return;
      }

      if (
        !dragMeta.isRoot &&
        !targetRow.meta.isRoot &&
        dragMeta.parentNodeId === targetRow.meta.parentNodeId
      ) {
        const parentNodeId = dragMeta.parentNodeId;
        const siblingLinkIds = dragMeta.siblingLinkIds ?? [];
        const from = dragMeta.siblingIndex ?? -1;
        const to = targetRow.meta.siblingIndex ?? -1;
        if (!parentNodeId || from < 0 || to < 0 || from === to) return;
        const orderedLinkIds =
          target.zone === "before"
            ? moveBefore(siblingLinkIds, from, to)
            : moveAfter(siblingLinkIds, from, to);
        await reorderChildren({ parentNodeId, userId, orderedLinkIds });
      }
    },
    [
      buildId,
      linkNodes,
      moveNodeIntoTarget,
      removeChildLink,
      reorderChildren,
      reorderRoots,
      rootOrderIds,
      setRootOrderIds,
      userId,
    ]
  );

  const startDrag = useCallback(
    async (meta: DragMeta, point: { x: number; y: number }) => {
      if (!userId) return;
      setDragging({ meta, point, target: null, busy: false });
      requestAnimationFrame(() => {
        void (async () => {
          await measureTargets();
          setDragging((current) => {
            if (!current.meta || current.meta.nodeId !== meta.nodeId) return current;
            return {
              ...current,
              target: resolveTarget(point.x, point.y, meta),
            };
          });
        })();
      });
    },
    [measureTargets, resolveTarget, userId]
  );

  const updateDragPoint = useCallback(
    (point: { x: number; y: number }) => {
      setDragging((current) => {
        if (!current.meta) return current;
        return {
          ...current,
          point,
          target: resolveTarget(point.x, point.y, current.meta),
        };
      });
    },
    [resolveTarget]
  );

  const finishDrag = useCallback(
    (point?: { x: number; y: number }) => {
      setDragging((current) => {
        if (!current.meta || current.busy) return current;
        const currentMeta = current.meta;
        const finalTarget =
          point != null ? resolveTarget(point.x, point.y, currentMeta) : current.target;
        void (async () => {
          try {
            setDragging((value) => ({ ...value, busy: true }));
            await commitDrop(finalTarget, currentMeta);
          } catch (error) {
            onError(error instanceof Error ? error.message : String(error));
          } finally {
            clearDrag();
          }
        })();
        return {
          ...current,
          point: point ?? current.point,
          target: finalTarget,
          busy: true,
        };
      });
    },
    [clearDrag, commitDrop, onError, resolveTarget]
  );

  const dragVisualState = useMemo(
    () => ({
      draggingNodeId: dragging.meta?.nodeId ?? null,
      dragOverNodeId: dragging.target?.nodeId ?? null,
      dragOverZone: dragging.target?.zone ?? null,
      dragPoint: dragging.point,
      busy: dragging.busy,
    }),
    [dragging]
  );

  return {
    registerRow,
    unregisterRow,
    registerRootDropZone,
    startDrag,
    updateDragPoint,
    finishDrag,
    clearDrag,
    dragMeta: dragging.meta,
    dragVisualState,
  };
}
