import { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";
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
  children: React.ReactNode;
};

/**
 * Drop surface for a workflow task row. Registers the row with the planner
 * controller so it can be measured as a drop target, and renders the
 * before/after/into drop indicators. Does NOT own the drag gesture — that
 * belongs to <WorkflowTaskDragHandle> inside the row. Wrapping the whole row
 * in a Pressable here would have its long-press eaten by the many interactive
 * controls inside (checkbox, title, edit, etc).
 */
export function WorkflowTaskDragShell({
  taskId,
  dragMeta,
  taskMove,
  depthMargin = 0,
  className = "",
  dropIntoLabel,
  children,
}: Props) {
  const rowRef = useRef<View>(null);

  const { draggingTaskId, dragOverTaskId, dragOverZone } = taskMove.dragVisualState;

  const dragging = draggingTaskId === taskId;
  const dropBefore = dragOverTaskId === taskId && dragOverZone === "before";
  const dropAfter = dragOverTaskId === taskId && dragOverZone === "after";
  const dropInto = dragOverTaskId === taskId && dragOverZone === "into";

  useEffect(() => {
    taskMove.registerRow(taskId, rowRef.current, dragMeta);
    return () => taskMove.unregisterRow(taskId);
  }, [dragMeta, taskId, taskMove]);

  const cardClass = useMemo(
    () =>
      dropInto
        ? "rounded-2xl border border-kyar-text bg-kyar-panelRaised shadow-sm dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised dark:shadow-none"
        : "rounded-2xl border border-kyar-borderSubtle bg-kyar-panel shadow-sm dark:border-kyar-dark-border dark:bg-kyar-dark-panelRaised dark:shadow-none",
    [dropInto]
  );

  return (
    <View style={{ marginLeft: depthMargin }} className={`relative mb-2 ${className}`}>
      <View
        ref={rowRef}
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
      </View>
    </View>
  );
}
