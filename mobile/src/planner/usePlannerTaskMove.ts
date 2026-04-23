import { useCallback, useMemo, useRef, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import {
  computePlannerTaskDropZone,
  pointInsideRect,
  type DropZone,
  type PlannerTaskDragMeta,
} from "@kyarafit/design-system/domain";

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
  meta: PlannerTaskDragMeta;
};

function measureView(
  view: {
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  } | null
): Promise<RectLike | null> {
  return new Promise((resolve) => {
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

type DropTarget =
  | {
      taskId: Id<"workflowItems">;
      zone: DropZone;
    }
  | null;

export function usePlannerTaskMove({
  userId,
  onCommitDrop,
  onError,
}: {
  userId: string | null;
  onCommitDrop: (
    dragged: PlannerTaskDragMeta,
    target: PlannerTaskDragMeta,
    zone: DropZone
  ) => Promise<void>;
  onError: (message: string) => void;
}) {
  const rowRegistryRef = useRef(new Map<string, RegisteredRow>());
  const rowRectsRef = useRef(new Map<string, RectLike>());

  const [dragging, setDragging] = useState<{
    meta: PlannerTaskDragMeta | null;
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
      taskId: Id<"workflowItems">,
      ref: {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null,
      meta: PlannerTaskDragMeta
    ) => {
      rowRegistryRef.current.set(taskId as string, { ref, meta });
    },
    []
  );

  const unregisterRow = useCallback((taskId: Id<"workflowItems">) => {
    rowRegistryRef.current.delete(taskId as string);
    rowRectsRef.current.delete(taskId as string);
  }, []);

  const measureTargets = useCallback(async () => {
    const entries = Array.from(rowRegistryRef.current.entries());
    const measured = await Promise.all(
      entries.map(async ([key, value]) => [key, await measureView(value.ref)] as const)
    );
    rowRectsRef.current = new Map(
      measured.filter((entry): entry is [string, RectLike] => entry[1] !== null)
    );
  }, []);

  const resolveTarget = useCallback((x: number, y: number, dragMeta: PlannerTaskDragMeta): DropTarget => {
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

    const zone = computePlannerTaskDropZone(y, rect, dragMeta, targetRow.meta);
    if (!zone) return null;
    return { taskId: targetRow.meta.taskId as Id<"workflowItems">, zone };
  }, []);

  const clearDrag = useCallback(() => {
    setDragging({ meta: null, point: null, target: null, busy: false });
  }, []);

  const commitDrop = useCallback(
    async (target: DropTarget, dragMeta: PlannerTaskDragMeta) => {
      if (!userId || !target) return;

      const targetRow = rowRegistryRef.current.get(target.taskId as string);
      if (!targetRow || dragMeta.taskId === targetRow.meta.taskId) return;

      try {
        await onCommitDrop(dragMeta, targetRow.meta, target.zone);
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [onCommitDrop, onError, userId]
  );

  const startDrag = useCallback(
    async (meta: PlannerTaskDragMeta, point: { x: number; y: number }) => {
      if (!userId) return;
      setDragging({ meta, point, target: null, busy: false });
      requestAnimationFrame(() => {
        void (async () => {
          await measureTargets();
          setDragging((current) => {
            if (!current.meta || current.meta.taskId !== meta.taskId) return current;
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

  const dragVisualState = useMemo(() => {
    const target = dragging.target;
    return {
      draggingTaskId: dragging.meta?.taskId ?? null,
      dragOverTaskId: target?.taskId ?? null,
      dragOverZone: target?.zone ?? null,
      dragPoint: dragging.point,
      busy: dragging.busy,
    };
  }, [dragging.meta?.taskId, dragging.point, dragging.target, dragging.busy]);

  return {
    registerRow,
    unregisterRow,
    startDrag,
    updateDragPoint,
    finishDrag,
    clearDrag,
    dragMeta: dragging.meta,
    dragVisualState,
  };
}

export type PlannerTaskMoveController = ReturnType<typeof usePlannerTaskMove>;
