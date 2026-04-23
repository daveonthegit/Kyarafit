import { useCallback, useRef } from "react";
import { Text, View } from "react-native";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";

type Props = {
  scopeKey: string;
  taskMove: PlannerTaskMoveController;
  label: string;
  className?: string;
};

export function WorkflowTaskRootDropZone({
  scopeKey,
  taskMove,
  label,
  className = "",
}: Props) {
  const zoneRef = useRef<View>(null);

  // Ref callback so the zone is registered synchronously when the View mounts.
  // `startDrag` schedules its measurement pass with rAF; an effect-based
  // register would race against that and miss the very first drag.
  const setZoneRef = useCallback(
    (node: View | null) => {
      zoneRef.current = node;
      if (node) {
        taskMove.registerRootDropZone(scopeKey, node);
      } else {
        taskMove.unregisterRootDropZone(scopeKey);
      }
    },
    [scopeKey, taskMove]
  );

  const activeScope = taskMove.dragMeta?.scopeKey;
  if (activeScope !== scopeKey || taskMove.dragMeta?.parentId == null) return null;

  const highlighted = taskMove.dragVisualState.dragOverRootScopeKey === scopeKey;

  return (
    <View
      ref={setZoneRef}
      className={`mb-2 rounded-2xl border border-dashed px-3 py-3 ${
        highlighted
          ? "border-kyar-text bg-kyar-panelRaised dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      } ${className}`}
    >
      <Text className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-kyar-meta dark:text-kyar-dark-meta">
        {label}
      </Text>
    </View>
  );
}
