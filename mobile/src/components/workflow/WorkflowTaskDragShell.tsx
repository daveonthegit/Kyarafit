import { useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { Id } from "convex/_generated/dataModel";
import type { PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";

type Props = {
  taskId: Id<"workflowItems">;
  dragMeta: PlannerTaskDragMeta;
  taskMove: PlannerTaskMoveController;
  /** Indent for nested tasks (px). */
  depthMargin?: number;
  className?: string;
  /** Shown when the dragged task targets the middle "nest" zone of this row. */
  dropIntoLabel?: string;
  /** Start moving from a long press anywhere on the row, matching build explorer. */
  rowLongPressDrag?: boolean;
  children: React.ReactNode;
};

/** Drop surface for a workflow task row. Registers the row as a measured target. */
export function WorkflowTaskDragShell({
  taskId,
  dragMeta,
  taskMove,
  depthMargin = 0,
  className = "",
  dropIntoLabel,
  rowLongPressDrag = false,
  children,
}: Props) {
  const rowRef = useRef<View>(null);

  const { draggingTaskId, dragOverTaskId, dragOverZone } = taskMove.dragVisualState;

  const dragging = draggingTaskId === taskId;
  const dropBefore = dragOverTaskId === taskId && dragOverZone === "before";
  const dropAfter = dragOverTaskId === taskId && dragOverZone === "after";
  const dropInto = dragOverTaskId === taskId && dragOverZone === "into";
  const { registerRow, unregisterRow } = taskMove;

  useEffect(() => {
    registerRow(taskId, rowRef.current, dragMeta);
  }, [dragMeta, registerRow, taskId]);

  useEffect(() => {
    return () => unregisterRow(taskId);
  }, [taskId, unregisterRow]);

  const cardClass = useMemo(
    () =>
      dropInto
        ? "rounded-2xl border border-kyar-text bg-kyar-panelRaised shadow-sm dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised dark:shadow-none"
        : "rounded-2xl border border-kyar-borderSubtle bg-kyar-panel shadow-sm dark:border-kyar-dark-border dark:bg-kyar-dark-panelRaised dark:shadow-none",
    [dropInto]
  );

  return (
    <View
      ref={rowRef}
      collapsable={false}
      style={{ marginLeft: depthMargin }}
      className={`relative mb-2 ${className}`}
    >
      <Pressable
        delayLongPress={220}
        onLongPress={
          rowLongPressDrag
            ? (event) =>
                void taskMove.startDrag(dragMeta, {
                  x: event.nativeEvent.pageX,
                  y: event.nativeEvent.pageY,
                })
            : undefined
        }
        onTouchMove={
          rowLongPressDrag
            ? (event) => {
                taskMove.updateDragPoint({
                  x: event.nativeEvent.pageX,
                  y: event.nativeEvent.pageY,
                });
              }
            : undefined
        }
        onTouchEnd={
          rowLongPressDrag
            ? (event) => {
                taskMove.finishDrag({
                  x: event.nativeEvent.pageX,
                  y: event.nativeEvent.pageY,
                });
              }
            : undefined
        }
        onTouchCancel={
          rowLongPressDrag
            ? () => {
                taskMove.finishDrag();
              }
            : undefined
        }
        className={`relative ${cardClass} ${dragging ? "opacity-55" : ""}`}
      >
        {dropBefore ? (
          <View className="absolute inset-x-2 top-0 z-10 h-1 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
        ) : null}
        {dropAfter ? (
          <View className="absolute inset-x-2 bottom-0 z-10 h-1 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
        ) : null}
        {children}
        {dropInto && dropIntoLabel ? (
          <Text className="mt-1 px-3 pb-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
            {dropIntoLabel}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
