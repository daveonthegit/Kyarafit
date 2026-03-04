import { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { Build, BuildTask } from "@kyarafit/design-system/types";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import {
  getBuild,
  getLinkedClosetItemIds,
  updateBuild as updateBuildLocal,
} from "../src/storage/buildsRepo";
import {
  listTasks,
  createTask,
  toggleTaskChecked,
  deleteTask,
  updateTask,
} from "../src/storage/buildTasksRepo";
import { listItems } from "../src/storage/closetRepo";
import type { ClosetItem } from "@kyarafit/design-system/types";

const STATUSES = ["idea", "wip", "ready"] as const;

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
  const { userId } = useCurrentUser();

  const buildId = id as Id<"builds"> | undefined;
  const convexBuild = useQuery(api.builds.get, userId && buildId ? { id: buildId } : "skip");
  const convexItemIds = useQuery(api.builds.getItems, userId && buildId ? { buildId } : "skip");
  const convexClosetItems = useQuery(api.closetItems.list, userId ? { userId } : "skip");
  const convexTasks = useQuery(
    api.buildTasks.listByBuild,
    userId && buildId ? { buildId } : "skip"
  );
  const updateBuildMut = useMutation(api.builds.update);
  const createTaskMut = useMutation(api.buildTasks.create);
  const updateTaskMut = useMutation(api.buildTasks.update);
  const deleteTaskMut = useMutation(api.buildTasks.remove);
  const toggleTaskMut = useMutation(api.buildTasks.update);

  const [localBuild, setLocalBuild] = useState<Build | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [localTasks, setLocalTasks] = useState<BuildTask[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id || userId) {
      if (!userId) setLocalLoaded(true);
      return;
    }
    const [b, ids, items, taskList] = await Promise.all([
      getBuild(id),
      getLinkedClosetItemIds(id),
      listItems(),
      listTasks(id),
    ]);
    setLocalBuild(b ?? null);
    setLinkedIds(ids);
    setClosetItems(items);
    setLocalTasks(taskList);
    setLocalLoaded(true);
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) setLocalLoaded(false);
      load();
    }, [load, userId])
  );

  const isCloud = !!userId;
  const build: Build | null = isCloud
    ? convexBuild
      ? {
          id: convexBuild._id,
          name: convexBuild.name,
          character: convexBuild.character,
          status: convexBuild.status as Build["status"],
          imageUrl: convexBuild.imageUrl,
          budgetCents: convexBuild.budgetCents,
          targetDate: convexBuild.targetDate,
          tasksTotal: convexBuild.tasksTotal ?? 0,
          tasksChecked: convexBuild.tasksChecked ?? 0,
          createdAt: "",
          updatedAt: "",
        }
      : null
    : localBuild;

  const linkedItems: ClosetItem[] = isCloud
    ? (convexClosetItems ?? [])
        .filter((c) => (convexItemIds ?? []).includes(c._id))
        .map((c) => ({
          id: c._id as string,
          name: c.name,
          category: c.category as ClosetItem["category"],
          tags: [],
          imageUrl: c.imageUrl,
          costCents: c.costCents,
          createdAt: "",
          updatedAt: "",
        }))
    : closetItems.filter((c) => linkedIds.includes(c.id));

  const tasks: BuildTask[] = isCloud
    ? (convexTasks ?? []).map((t) => ({
        id: t._id,
        buildId: t.buildId,
        label: t.label,
        closetItemId: t.closetItemId ?? undefined,
        sortOrder: t.sortOrder,
        checked: t.checked,
        createdAt: "",
        updatedAt: "",
      }))
    : localTasks;

  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCharacter, setEditCharacter] = useState("");
  const [editStatus, setEditStatus] = useState<string>("wip");
  const [editBudgetCents, setEditBudgetCents] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    if (build && isEditing) {
      setEditName(build.name);
      setEditCharacter(build.character ?? "");
      setEditStatus(build.status ?? "wip");
      setEditBudgetCents(build.budgetCents != null ? (build.budgetCents / 100).toFixed(2) : "");
      setEditTargetDate(build.targetDate ?? "");
    }
  }, [build, isEditing]);

  const loaded = isCloud ? convexBuild !== undefined : localLoaded;

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
    if (isCloud && userId) {
      await createTaskMut({
        userId,
        buildId: buildId!,
        label: newTaskLabel.trim(),
        sortOrder: tasks.length,
      });
    } else if (!isCloud) {
      await createTask(id, {
        label: newTaskLabel.trim(),
        sortOrder: tasks.length,
      });
      const next = await listTasks(id);
      setLocalTasks(next);
    }
    setNewTaskLabel("");
  };

  const onToggleTask = async (taskId: string) => {
    if (!id) return;
    const task = tasks.find((t) => t.id === taskId);
    const newChecked = task ? !task.checked : false;
    if (isCloud && userId) {
      await toggleTaskMut({
        id: taskId as Id<"buildTasks">,
        userId,
        checked: newChecked,
      });
    } else {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, checked: newChecked } : t))
      );
      try {
        await toggleTaskChecked(taskId, id);
      } catch (error) {
        console.error("Failed to toggle task:", error);
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, checked: !newChecked } : t))
        );
      }
    }
  };

  const onDeleteTask = async (taskId: string) => {
    if (!id) return;
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (isCloud && userId) {
            await deleteTaskMut({ id: taskId as Id<"buildTasks">, userId });
          } else {
            setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
            try {
              await deleteTask(taskId, id);
            } catch (error) {
              console.error("Failed to delete task:", error);
              const reloaded = await listTasks(id);
              setLocalTasks(reloaded);
            }
          }
        },
      },
    ]);
  };

  const onLongPressTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setAssignModalVisible(true);
  };

  const onAssignTask = async (closetItemId: string | null) => {
    if (!id || !selectedTaskId) return;
    setAssignModalVisible(false);
    setSelectedTaskId(null);
    if (isCloud && userId) {
      await updateTaskMut({
        id: selectedTaskId as Id<"buildTasks">,
        userId,
        closetItemId: closetItemId ? (closetItemId as Id<"closetItems">) : undefined,
      });
    } else {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId ? { ...t, closetItemId: closetItemId ?? undefined } : t
        )
      );
      try {
        await updateTask(selectedTaskId, id, { closetItemId });
      } catch (error) {
        console.error("Failed to assign task:", error);
        const reloaded = await listTasks(id);
        setLocalTasks(reloaded);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!build || !editName.trim()) return;
    setSavePending(true);
    try {
      if (isCloud && userId) {
        await updateBuildMut({
          id: build.id as Id<"builds">,
          userId,
          name: editName.trim(),
          character: editCharacter.trim() || undefined,
          status: editStatus as Build["status"],
          budgetCents: editBudgetCents.trim()
            ? Math.round(parseFloat(editBudgetCents) * 100)
            : undefined,
          targetDate: editTargetDate.trim() || undefined,
        });
      } else {
        await updateBuildLocal(build.id, {
          name: editName.trim(),
          character: editCharacter.trim() || undefined,
          status: editStatus as Build["status"],
          budgetCents: editBudgetCents.trim()
            ? Math.round(parseFloat(editBudgetCents) * 100)
            : undefined,
          targetDate: editTargetDate.trim() || undefined,
        });
        setLocalBuild((prev) =>
          prev
            ? {
                ...prev,
                name: editName.trim(),
                character: editCharacter.trim() || undefined,
                status: editStatus as Build["status"],
                budgetCents: editBudgetCents.trim()
                  ? Math.round(parseFloat(editBudgetCents) * 100)
                  : undefined,
                targetDate: editTargetDate.trim() || undefined,
              }
            : null
        );
      }
      setIsEditing(false);
    } finally {
      setSavePending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.metaLabel} numberOfLines={1}>
          {build.name}
        </Text>
        {!isEditing ? (
          <Pressable onPress={() => setIsEditing(true)} hitSlop={12}>
            <Ionicons name="pencil-outline" size={22} color={colors.black} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setIsEditing(false)} disabled={savePending}>
            <Text style={styles.cancelEditText}>Cancel</Text>
          </Pressable>
        )}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isEditing ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EDIT BUILD</Text>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Name</Text>
              <TextInput
                style={styles.taskInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Build name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Character (optional)</Text>
              <TextInput
                style={styles.taskInput}
                value={editCharacter}
                onChangeText={setEditCharacter}
                placeholder="e.g. Arlecchino"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Status</Text>
              <View style={styles.statusRow}>
                {STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.statusBtn, editStatus === s && styles.statusBtnActive]}
                    onPress={() => setEditStatus(s)}
                  >
                    <Text
                      style={[styles.statusBtnText, editStatus === s && styles.statusBtnTextActive]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Budget $ (optional)</Text>
              <TextInput
                style={styles.taskInput}
                value={editBudgetCents}
                onChangeText={setEditBudgetCents}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Deadline (optional)</Text>
              <TextInput
                style={styles.taskInput}
                value={editTargetDate}
                onChangeText={setEditTargetDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.editActions}>
              <Pressable
                style={[styles.primaryBtn, savePending && styles.disabled]}
                onPress={handleSaveEdit}
                disabled={savePending || !editName.trim()}
              >
                <Text style={styles.primaryBtnText}>
                  {savePending ? "Saving…" : "Save changes"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setIsEditing(false)}
                disabled={savePending}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
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
              {tasks.map((t) => {
                const linkedItem = linkedItems.find((item) => item.id === t.closetItemId);
                return (
                  <View key={t.id} style={styles.taskRowContainer}>
                    <Pressable style={styles.taskRow} onPress={() => onToggleTask(t.id)}>
                      <View style={[styles.checkbox, t.checked && styles.checkboxChecked]}>
                        {t.checked && <Ionicons name="checkmark" size={12} color={colors.white} />}
                      </View>
                      <View style={styles.taskContent}>
                        <Text style={[styles.taskLabel, t.checked && styles.taskLabelChecked]}>
                          {t.label}
                        </Text>
                        {linkedItem && <Text style={styles.taskAssigned}>→ {linkedItem.name}</Text>}
                      </View>
                    </Pressable>
                    <Pressable style={styles.taskActionBtn} onPress={() => onLongPressTask(t.id)}>
                      <Ionicons name="link-outline" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable style={styles.taskActionBtn} onPress={() => onDeleteTask(t.id)}>
                      <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Associated Closet Items */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>
                  ASSOCIATED CLOSET ITEMS ({linkedItems.length})
                </Text>
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
          </>
        )}
      </ScrollView>

      {/* Task Assignment Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Task to Item</Text>
              <Pressable onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll}>
              {selectedTaskId && (
                <Pressable style={styles.modalOption} onPress={() => onAssignTask(null)}>
                  <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.modalOptionText}>Unassign from any item</Text>
                </Pressable>
              )}
              {linkedItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.modalOption}
                  onPress={() => onAssignTask(item.id)}
                >
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.modalItemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.modalItemImage, styles.modalItemImagePlaceholder]}>
                      <Ionicons name="image-outline" size={16} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={styles.modalOptionText}>{item.name}</Text>
                </Pressable>
              ))}
              {linkedItems.length === 0 && (
                <Text style={styles.modalEmpty}>
                  No closet items linked to this build. Link items first to assign tasks.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  cancelEditText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.textTertiary,
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
  editField: { marginBottom: 20 },
  editLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginBottom: 8,
  },
  editActions: { gap: 12, marginTop: 24 },
  primaryBtn: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 2,
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.white,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 2,
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.black,
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
  },
  statusBtnActive: { borderColor: colors.black, backgroundColor: colors.muted },
  statusBtnText: { fontSize: 12, fontWeight: "600", color: colors.textTertiary },
  statusBtnTextActive: { color: colors.black },
  disabled: { opacity: 0.5 },
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
  taskRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  taskContent: {
    flex: 1,
  },
  taskAssigned: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: "italic",
    marginTop: 2,
  },
  taskActionBtn: {
    padding: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
  },
  modalScroll: {
    padding: 20,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  modalItemImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  modalItemImagePlaceholder: {
    backgroundColor: colors.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  modalEmpty: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: "center",
    paddingVertical: 20,
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
