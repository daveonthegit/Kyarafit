import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import type { Id } from "convex/_generated/dataModel";
import type { PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";
import { useDesignTheme } from "@/theme/useDesignTheme";

type Props = {
  taskId: Id<"workflowItems">;
  dragMeta: PlannerTaskDragMeta;
  taskMove: PlannerTaskMoveController;
  className?: string;
};

/**
 * Dedicated drag grip for a workflow task row. Long-press starts the drag and
 * the same Pressable keeps the native touch responder for the whole gesture,
 * so `onTouchMove`/`onTouchEnd` continue to flow here even when the finger
 * moves over sibling rows or other interactive controls inside the row.
 */
export function WorkflowTaskDragHandle({ dragMeta, taskMove, className = "" }: Props) {
  const { colors } = useDesignTheme();

  return (
    <Pressable
      delayLongPress={220}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Drag to reorder"
      onLongPress={(event) =>
        void taskMove.startDrag(dragMeta, {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        })
      }
      onTouchMove={(event) => {
        taskMove.updateDragPoint({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        });
      }}
      onTouchEnd={(event) => {
        taskMove.finishDrag({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        });
      }}
      onTouchCancel={() => {
        taskMove.finishDrag();
      }}
      className={`h-9 w-9 items-center justify-center rounded-full ${className}`}
    >
      <Ionicons name="reorder-three" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}
