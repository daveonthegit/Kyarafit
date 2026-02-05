import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Image } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { Build, BuildTask } from "@kyarafit/design-system/types";
import { getBuild, getLinkedClosetItemIds } from "../src/storage/buildsRepo";
import { listTasks, createTask, toggleTaskChecked } from "../src/storage/buildTasksRepo";
import { listItems } from "../src/storage/closetRepo";
import type { ClosetItem } from "@kyarafit/design-system/types";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function BuildDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const router = useRouter();
  const [build, setBuild] = useState<Build | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [tasks, setTasks] = useState<BuildTask[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }
    const [b, ids, items, taskList] = await Promise.all([
      getBuild(id),
      getLinkedClosetItemIds(id),
      listItems(),
      listTasks(id),
    ]);
    setBuild(b ?? null);
    setLinkedIds(ids);
    setClosetItems(items);
    setTasks(taskList);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoaded(false);
      load();
    }, [load])
  );

  if (!id) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.black} />
          </Pressable>
          <Text style={styles.metaLabel}>Build</Text>
        </View>
        <Text style={styles.meta}>Missing build id.</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Loading…</Text>
      </View>
    );
  }

  if (!build) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.black} />
          </Pressable>
          <Text style={styles.metaLabel}>Build</Text>
        </View>
        <Text style={styles.meta}>Build not found.</Text>
      </View>
    );
  }

  const linkedItems = closetItems.filter((c) => linkedIds.includes(c.id));
  const totalCostCents = linkedItems.reduce((sum, i) => sum + (i.costCents ?? 0), 0);

  const tasksChecked = tasks.filter((t) => t.checked).length;
  const tasksTotal = tasks.length;
  const completionPercent = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

  // Calculate days until deadline
  const getDaysRemaining = (targetDate: string | null | undefined) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining(build.targetDate);

  const onAddTask = async () => {
    if (!newTaskLabel.trim() || !id) return;
    await createTask(id, {
      label: newTaskLabel.trim(),
      sortOrder: tasks.length,
    });
    setNewTaskLabel("");
    const next = await listTasks(id);
    setTasks(next);
  };

  const onToggleTask = async (taskId: string) => {
    if (!id) return;
    const updated = await toggleTaskChecked(taskId, id);
    if (updated)
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, checked: updated.checked } : t))
      );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.metaLabel}>{build.name}</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Hero image */}
        {build.imageUrl && (
          <View style={styles.heroImage}>
            <Image source={{ uri: build.imageUrl }} style={styles.image} resizeMode="cover" />
          </View>
        )}

        {/* Project overview */}
        <View style={styles.overview}>
          <Text style={styles.statusText}>{build.status.toUpperCase()}</Text>
          <Text style={styles.title}>{build.name}</Text>
          {build.character && <Text style={styles.subtitle}>Character: {build.character}</Text>}
        </View>

        {/* Metrics / Summary */}
        <View style={styles.metrics}>
          {/* Completion */}
          <View style={styles.metricBlock}>
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>COMPLETION</Text>
              <Text style={styles.metricValue}>{completionPercent}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${completionPercent}%` }]} />
            </View>
            <Text style={styles.metricCaption}>
              {tasksChecked} of {tasksTotal} tasks complete
            </Text>
          </View>

          {/* Deadline */}
          {build.targetDate && daysRemaining !== null && (
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>DEADLINE</Text>
              <View style={styles.deadlineRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.text} />
                <View style={styles.deadlineContent}>
                  <Text style={styles.deadlineDate}>
                    {new Date(build.targetDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                  <Text
                    style={[
                      styles.deadlineRemaining,
                      daysRemaining < 0
                        ? styles.deadlineOverdue
                        : daysRemaining <= 7
                          ? styles.deadlineUrgent
                          : {},
                    ]}
                  >
                    {daysRemaining < 0
                      ? `${Math.abs(daysRemaining)} days overdue`
                      : daysRemaining === 0
                        ? "Due today!"
                        : `${daysRemaining} days remaining`}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Budget Tracker */}
        {build.budgetCents != null && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BUDGET TRACKER</Text>
            <View style={styles.budgetBlock}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetText}>Spent: {formatCents(totalCostCents)}</Text>
                <Text style={styles.budgetText}>Budget: {formatCents(build.budgetCents)}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, (totalCostCents / (build.budgetCents || 1)) * 100)}%`,
                    },
                  ]}
                />
              </View>
              {totalCostCents > (build.budgetCents || 0) && (
                <Text style={styles.overbudget}>
                  Over budget by {formatCents(totalCostCents - (build.budgetCents || 0))}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TASKS</Text>
          <View style={styles.taskAddRow}>
            <TextInput
              style={styles.taskInput}
              value={newTaskLabel}
              onChangeText={setNewTaskLabel}
              placeholder="Required item or step…"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable style={styles.taskAddBtn} onPress={onAddTask}>
              <Text style={styles.taskAddBtnText}>ADD</Text>
            </Pressable>
          </View>
          {tasks.map((t) => (
            <Pressable key={t.id} style={styles.taskRow} onPress={() => onToggleTask(t.id)}>
              <View style={[styles.checkbox, t.checked && styles.checkboxChecked]}>
                {t.checked && <Ionicons name="checkmark" size={12} color={colors.white} />}
              </View>
              <Text style={[styles.taskLabel, t.checked && styles.taskLabelChecked]}>
                {t.closetItemId ? `${t.label} (linked)` : t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Associated Closet Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ASSOCIATED CLOSET ITEMS ({linkedItems.length})</Text>
            <Pressable
              style={styles.linkBtn}
              onPress={() =>
                router.push({
                  pathname: "/build-link-items",
                  params: { buildId: id! },
                })
              }
            >
              <Text style={styles.linkBtnText}>LINK ITEMS</Text>
            </Pressable>
          </View>
          {linkedItems.length === 0 && (
            <Text style={styles.meta}>
              No items linked. Tap "Link items" to add pieces from your closet.
            </Text>
          )}
          <View style={styles.gallery}>
            {linkedItems.map((item) => (
              <View key={item.id} style={styles.galleryItem}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.galleryImage, styles.galleryImagePlaceholder]}>
                    <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                  </View>
                )}
                <Text style={styles.galleryItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.galleryItemMeta}>
                  {item.category}
                  {item.costCents != null ? ` · ${formatCents(item.costCents)}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Progress Photos Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PROGRESS PHOTOS</Text>
          <View style={styles.placeholder}>
            <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.placeholderText}>
              Progress photos feature coming soon. Track your build with photos and dates.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
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
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  heroImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.muted,
    marginBottom: 16,
  },
  image: { width: "100%", height: "100%" },
  overview: {
    paddingHorizontal: layout.screenPaddingX,
    marginBottom: 24,
  },
  statusText: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: 8,
  },
  title: {
    fontFamily: font.serif,
    fontSize: 32,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  metrics: {
    paddingHorizontal: layout.screenPaddingX,
    gap: 24,
    marginBottom: 24,
  },
  metricBlock: {
    gap: 8,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  metricLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "500",
    color: colors.textTertiary,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.black,
  },
  metricCaption: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  progressBarBg: {
    height: 2,
    backgroundColor: "#eeeeee",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.black,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 8,
  },
  deadlineContent: {
    flex: 1,
    gap: 4,
  },
  deadlineDate: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  deadlineRemaining: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  deadlineOverdue: {
    color: "#dc2626",
  },
  deadlineUrgent: {
    color: "#ea580c",
  },
  section: {
    paddingHorizontal: layout.screenPaddingX,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginBottom: 16,
  },
  budgetBlock: {
    gap: 8,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  budgetText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  overbudget: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 4,
  },
  linkBtn: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 2,
  },
  linkBtnText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.black,
  },
  meta: { fontSize: 12, color: colors.textTertiary, marginTop: 8 },
  taskAddRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  taskInput: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  taskAddBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.black,
    justifyContent: "center",
  },
  taskAddBtnText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: colors.black,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.black, borderColor: colors.black },
  taskLabel: { flex: 1, fontSize: 14, color: colors.text },
  taskLabelChecked: {
    textDecorationLine: "line-through",
    color: colors.textTertiary,
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  galleryItem: {
    width: "47%",
    gap: 8,
  },
  galleryImage: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.muted,
  },
  galleryImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  galleryItemName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text,
  },
  galleryItemMeta: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  placeholder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    padding: 32,
    alignItems: "center",
    gap: 12,
    borderRadius: 2,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
