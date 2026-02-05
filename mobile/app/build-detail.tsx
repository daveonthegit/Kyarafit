import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { Build, BuildTask } from "@kyarafit/design-system/types";
import { getBuild, getLinkedClosetItemIds } from "../src/storage/buildsRepo";
import {
  listTasks,
  createTask,
  toggleTaskChecked,
} from "../src/storage/buildTasksRepo";
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
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : undefined;
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
    }, [load]),
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
  const totalCostCents = linkedItems.reduce(
    (sum, i) => sum + (i.costCents ?? 0),
    0,
  );

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
        prev.map((t) =>
          t.id === taskId ? { ...t, checked: updated.checked } : t,
        ),
      );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.metaLabel}>Build</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {build.imageUrl && (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: build.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        )}
        <Text style={styles.title}>{build.name}</Text>
        <Text style={styles.meta}>Status: {build.status}</Text>
        {build.character && (
          <Text style={styles.meta}>Character: {build.character}</Text>
        )}
        {(build.budgetCents != null || totalCostCents > 0) && (
          <Text style={styles.meta}>
            {build.budgetCents != null &&
              `Budget: ${formatCents(build.budgetCents)}`}
            {build.budgetCents != null && totalCostCents > 0 && " · "}
            {totalCostCents > 0 &&
              `Linked total: ${formatCents(totalCostCents)}`}
          </Text>
        )}

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
          <Pressable
            key={t.id}
            style={styles.taskRow}
            onPress={() => onToggleTask(t.id)}
          >
            <View
              style={[styles.checkbox, t.checked && styles.checkboxChecked]}
            >
              {t.checked && (
                <Ionicons name="checkmark" size={12} color={colors.white} />
              )}
            </View>
            <Text
              style={[styles.taskLabel, t.checked && styles.taskLabelChecked]}
            >
              {t.closetItemId ? `${t.label} (linked)` : t.label}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.linkBtn}
          onPress={() =>
            router.push({
              pathname: "/build-link-items",
              params: { buildId: id! },
            })
          }
        >
          <Text style={styles.linkBtnText}>LINK CLOSET ITEMS</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>
          LINKED ITEMS ({linkedItems.length})
        </Text>
        {linkedItems.length === 0 && (
          <Text style={styles.meta}>
            No items linked. Tap "Link closet items" to add pieces from your
            closet.
          </Text>
        )}
        {linkedItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemCategory}>
              {item.category}
              {item.costCents != null
                ? ` · ${formatCents(item.costCents)}`
                : ""}
            </Text>
          </View>
        ))}
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
  scrollContent: { padding: layout.screenPaddingX, paddingBottom: 48 },
  title: {
    fontFamily: font.serif,
    fontSize: 28,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    marginTop: 24,
  },
  meta: { fontSize: 12, color: colors.textTertiary, marginTop: 8 },
  linkBtn: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: "center",
    borderRadius: 2,
  },
  linkBtnText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.black,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginTop: 32,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  itemName: { fontSize: 14, fontWeight: "500", color: colors.text },
  itemCategory: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    maxHeight: 180,
    backgroundColor: colors.muted,
    marginTop: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  taskAddRow: { flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 16 },
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
});
