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
      kind: "row";
      taskId: Id<"workflowItems">;
      zone: DropZone;
    }
  | {
      kind: "root";
      scopeKey: string;
    }
  | null;

export function usePlannerTaskMove({
  userId,
  onCommitDrop,
  onCommitRootDrop,
  onError,
}: {
  userId: string | null;
  onCommitDrop: (
    dragged: PlannerTaskDragMeta,
    target: PlannerTaskDragMeta,
    zone: DropZone
  ) => Promise<void>;
  onCommitRootDrop?: (dragged: PlannerTaskDragMeta, scopeKey: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const rowRegistryRef = useRef(new Map<string, RegisteredRow>());
  const rowRectsRef = useRef(new Map<string, RectLike>());
  const rootDropRegistryRef = useRef(
    new Map<
      string,
      {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null
    >()
  );
  const rootDropRectsRef = useRef(new Map<string, RectLike>());

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

  const registerRootDropZone = useCallback(
    (
      scopeKey: string,
      ref: {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null
    ) => {
      rootDropRegistryRef.current.set(scopeKey, ref);
      // Root drop zones typically mount only during an active drag, so we
      // measure them immediately instead of waiting for the next drag start.
      if (ref?.measureInWindow) {
        requestAnimationFrame(() => {
          void measureView(ref).then((rect) => {
            if (rect) rootDropRectsRef.current.set(scopeKey, rect);
          });
        });
      }
    },
    []
  );

  const unregisterRootDropZone = useCallback((scopeKey: string) => {
    rootDropRegistryRef.current.delete(scopeKey);
    rootDropRectsRef.current.delete(scopeKey);
  }, []);

  const measureTargets = useCallback(async () => {
    const entries = Array.from(rowRegistryRef.current.entries());
    const measured = await Promise.all(
      entries.map(async ([key, value]) => [key, await measureView(value.ref)] as const)
    );
    rowRectsRef.current = new Map(
      measured.filter((entry): entry is [string, RectLike] => entry[1] !== null)
    );

    const rootEntries = Array.from(rootDropRegistryRef.current.entries());
    const measuredRoots = await Promise.all(
      rootEntries.map(async ([scopeKey, ref]) => [scopeKey, await measureView(ref)] as const)
    );
    rootDropRectsRef.current = new Map(
      measuredRoots.filter((entry): entry is [string, RectLike] => entry[1] !== null)
    );
  }, []);

  const resolveTarget = useCallback(
    (x: number, y: number, dragMeta: PlannerTaskDragMeta): DropTarget => {
      const rootRect = rootDropRectsRef.current.get(dragMeta.scopeKey);
      if (dragMeta.parentId != null && rootRect && pointInsideRect(x, y, rootRect)) {
        return { kind: "root", scopeKey: dragMeta.scopeKey };
      }

      const candidates: { key: string; rect: RectLike; distance: number; inside: boolean }[] = [];

      for (const [key, rect] of rowRectsRef.current.entries()) {
        const inside = pointInsideRect(x, y, rect);
        const withinHorizontalReach = x >= rect.left - 36 && x <= rect.right + 36;
        if (!inside && !withinHorizontalReach) continue;
        const verticalDistance =
          y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        if (!inside && verticalDistance > 18) continue;
        candidates.push({ key, rect, distance: verticalDistance, inside });
      }

      candidates.sort((a, b) => {
        if (a.inside !== b.inside) return a.inside ? -1 : 1;
        return a.distance - b.distance;
      });

      for (const candidate of candidates) {
        const targetRow = rowRegistryRef.current.get(candidate.key);
        if (!targetRow) continue;
        const zone = computePlannerTaskDropZone(y, candidate.rect, dragMeta, targetRow.meta);
        if (!zone) continue;
        return { kind: "row", taskId: targetRow.meta.taskId as Id<"workflowItems">, zone };
      }

      return null;
    },
    []
  );

  const clearDrag = useCallback(() => {
    setDragging({ meta: null, point: null, target: null, busy: false });
  }, []);

  const commitDrop = useCallback(
    async (target: DropTarget, dragMeta: PlannerTaskDragMeta) => {
      if (!userId || !target) return;

      if (target.kind === "root") {
        await onCommitRootDrop?.(dragMeta, target.scopeKey);
        return;
      }

      const targetRow = rowRegistryRef.current.get(target.taskId as string);
      if (!targetRow || dragMeta.taskId === targetRow.meta.taskId) return;

      try {
        await onCommitDrop(dragMeta, targetRow.meta, target.zone);
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [onCommitDrop, onCommitRootDrop, onError, userId]
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
            const latestPoint = current.point ?? point;
            return {
              ...current,
              target: resolveTarget(latestPoint.x, latestPoint.y, meta),
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
      dragOverTaskId: target?.kind === "row" ? target.taskId : null,
      dragOverZone: target?.kind === "row" ? target.zone : null,
      dragOverRootScopeKey: target?.kind === "root" ? target.scopeKey : null,
      dragPoint: dragging.point,
      busy: dragging.busy,
    };
  }, [dragging.meta?.taskId, dragging.point, dragging.target, dragging.busy]);

  return {
    registerRow,
    unregisterRow,
    registerRootDropZone,
    unregisterRootDropZone,
    startDrag,
    updateDragPoint,
    finishDrag,
    clearDrag,
    dragMeta: dragging.meta,
    dragVisualState,
  };
}

export type PlannerTaskMoveController = ReturnType<typeof usePlannerTaskMove>;
