import { Text, View } from "react-native";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";

type Props = {
  taskMove: PlannerTaskMoveController;
  /** Fallback label if the dragged task has no title. */
  fallbackLabel: string;
  /** Screen-relative offset of the parent view; ghost is rendered inside it. */
  rootOffset?: { x: number; y: number };
};

/**
 * Decorative dragging ghost. Mirrors the build-explorer pattern: purely
 * visual, `pointerEvents="none"`, positioned by the drag point reported by
 * the controller. Must NOT install any touch responders — the drag gesture
 * is owned by <WorkflowTaskDragHandle>.
 */
export function WorkflowTaskDragOverlay({
  taskMove,
  fallbackLabel,
  rootOffset = { x: 0, y: 0 },
}: Props) {
  const dragMeta = taskMove.dragMeta;
  const dragPoint = taskMove.dragVisualState.dragPoint;

  if (!dragMeta || !dragPoint) return null;

  const label = dragMeta.title?.trim() || fallbackLabel;

  return (
    <View
      pointerEvents="none"
      className="absolute"
      style={{
        left: Math.max(12, dragPoint.x - rootOffset.x - 120),
        top: Math.max(12, dragPoint.y - rootOffset.y - 36),
      }}
    >
      <View className="rounded-full bg-kyar-text px-4 py-3 shadow-fab dark:bg-kyar-dark-text">
        <Text
          numberOfLines={1}
          className="max-w-[240px] text-[11px] font-semibold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg"
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
