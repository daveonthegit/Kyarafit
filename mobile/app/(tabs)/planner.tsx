import { useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { colors, font } from "@kyarafit/design-system/rn";
import { ChecklistRow } from "../../src/components/ui/ChecklistRow";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";

const TODAY = new Date().toISOString().slice(0, 10);

function formatDueDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  if (dateStr === TODAY) return "Today";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function PlannerTabScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const plannerTasks = useQuery(api.buildTasks.listForPlanner, userId ? { userId } : "skip");
  const updateTask = useMutation(api.buildTasks.update);

  const handleToggle = useCallback(
    async (taskId: Id<"buildTasks">, checked: boolean) => {
      if (!userId) return;
      try {
        await updateTask({ id: taskId, userId, checked });
      } catch {
        // Error surfaces via Convex
      }
    },
    [userId, updateTask]
  );

  const tasks = plannerTasks ?? [];
  const checkedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.metaLabel}>Tasks</Text>
        <Text style={styles.title}>Planner</Text>
        {totalCount > 0 && (
          <Text style={styles.progressText}>
            {checkedCount} / {totalCount} done
          </Text>
        )}
      </View>

      {totalCount > 0 && (
        <View style={styles.progressBarWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tasks.length === 0 && (
          <Text style={styles.empty}>No tasks yet. Add builds and tasks to see them here.</Text>
        )}
        {tasks.map((task) => (
          <View key={task._id} style={styles.taskRow}>
            <ChecklistRow
              label={task.label}
              checked={task.checked}
              onToggle={() => handleToggle(task._id, !task.checked)}
            />
            <View style={styles.taskMeta}>
              {task.dueDate ? (
                <Text style={styles.dueDate}>{formatDueDate(task.dueDate)}</Text>
              ) : null}
              {task.buildId ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/build-detail", params: { id: task.buildId } })
                  }
                  hitSlop={8}
                >
                  <Text style={styles.buildLink}>{task.buildName}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginBottom: 4,
  },
  title: {
    fontFamily: font.family.serifDisplay,
    fontSize: 28,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    letterSpacing: -0.5,
  },
  progressText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressBarWrap: { paddingHorizontal: 24, paddingTop: 12 },
  progressBar: {
    height: 4,
    backgroundColor: colors.borderSubtle,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.black,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 120 },
  taskRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
    paddingLeft: 28,
  },
  dueDate: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  buildLink: { fontSize: 11, color: colors.textSecondary, textDecorationLine: "underline" },
  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
    color: colors.textTertiary,
    paddingHorizontal: 24,
  },
});
