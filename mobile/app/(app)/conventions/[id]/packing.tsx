import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { WorkflowTaskEditorModal } from "@/components/workflow/WorkflowTaskEditorModal";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard, TextField } from "@/ui";
import {
  enumerateConventionDays,
  groupPackingByDate,
  type ConventionPackingItem,
} from "@/screens/conventions/utils";

type Ready = {
  userId: string;
  convention: Doc<"conventions">;
  items: ConventionPackingItem[];
};

export default function ConventionPackingScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; day?: string | string[] }>();
  const initialDay = Array.isArray(params.day) ? params.day[0] : params.day;
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const convention = useOfflineQuery(
    api.conventions.get,
    params.id ? { id: params.id as Id<"conventions"> } : "skip"
  );
  const items = useOfflineQuery(
    api.conventions.getPacking,
    params.id ? { conventionId: params.id as Id<"conventions"> } : "skip"
  );

  const loading =
    identity === undefined || (userId != null && (convention === undefined || items === undefined));
  const error =
    identity === null
      ? new Error(t("builds.loadError"))
      : convention === null
        ? new Error(t("conventions.notFound"))
        : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || !convention || !items) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && userId && convention && items ? { userId, convention, items } : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          title: convention?.name ?? t("conventions.dayPackingTitle"),
        }}
      />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <ConventionPackingBody {...loaded} initialDay={initialDay} />}
      </DataBoundary>
    </>
  );
}

function ConventionPackingBody({
  userId,
  convention,
  items,
  initialDay,
}: Ready & { initialDay?: string }) {
  const { t } = useTranslation();
  const updateItem = useOfflineMutation(api.conventions.updatePackingItem);
  const regeneratePacking = useOfflineMutation(api.conventions.regeneratePacking);
  const addManualPackingItem = useOfflineMutation(api.conventions.addManualPackingItem);
  const deletePackingItem = useOfflineMutation(api.conventions.deletePackingItem);
  const days = useMemo(
    () => enumerateConventionDays(convention.startDate, convention.endDate),
    [convention.endDate, convention.startDate]
  );
  const [selectedDay, setSelectedDay] = useState<string | "all">(initialDay ?? "all");
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemNotes, setNewItemNotes] = useState("");
  const [editingItem, setEditingItem] = useState<ConventionPackingItem | null>(null);
  const [editorTaskId, setEditorTaskId] = useState<Id<"workflowItems"> | null>(null);
  const swipeRef = useRef<Swipeable | null>(null);

  const visibleItems = useMemo(() => {
    if (selectedDay === "all") return items;
    return items.filter((item) => item.date === selectedDay || !item.date);
  }, [items, selectedDay]);

  const grouped = useMemo(() => groupPackingByDate(visibleItems), [visibleItems]);
  const editorCandidates = useMemo(
    () =>
      items
        .filter(
          (
            item
          ): item is ConventionPackingItem & {
            workflowItemId: Id<"workflowItems">;
          } => item.workflowItemId !== undefined
        )
        .map((item) => ({ _id: item.workflowItemId, title: item.label })),
    [items]
  );

  const saveManualItem = useCallback(async () => {
    const label = newItemLabel.trim();
    if (!label) return;
    try {
      await addManualPackingItem({
        userId,
        conventionId: convention._id,
        label,
        notes: newItemNotes.trim() || undefined,
        date: selectedDay === "all" ? undefined : selectedDay,
      });
      setNewItemLabel("");
      setNewItemNotes("");
      setNewItemOpen(false);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  }, [addManualPackingItem, convention._id, newItemLabel, newItemNotes, selectedDay, t, userId]);

  const saveEditedItem = useCallback(async () => {
    if (!editingItem) return;
    try {
      await updateItem({
        id: editingItem._id,
        userId,
        label: editingItem.label,
        notes: editingItem.notes,
        date: editingItem.date,
      });
      setEditingItem(null);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  }, [editingItem, t, updateItem, userId]);

  return (
    <>
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 40,
          gap: 20,
        }}
      >
        <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("conventions.packingSubtitle")}
        </Text>

        <SurfaceCard className="px-4 py-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            <DayPill
              active={selectedDay === "all"}
              label={t("conventions.packingAllDays")}
              onPress={() => setSelectedDay("all")}
            />
            {days.map((date, index) => (
              <DayPill
                key={date}
                active={selectedDay === date}
                label={`D${index + 1}`}
                onPress={() => setSelectedDay(date)}
              />
            ))}
          </ScrollView>

          <View className="mt-4 flex-row gap-3">
            <Button
              title={t("conventions.addPackingAction")}
              variant="secondary"
              onPress={() => setNewItemOpen(true)}
              className="flex-1"
            />
            <Button
              title={t("conventions.regeneratePackingAction")}
              variant="secondary"
              onPress={() => void regeneratePacking({ userId, conventionId: convention._id })}
              className="flex-1"
            />
          </View>
        </SurfaceCard>

        {grouped.general.length > 0 ? (
          <PackingSection
            title={t("conventions.generalPacking")}
            items={grouped.general}
            onToggle={(item) => updateItem({ id: item._id, userId, checked: !item.checked })}
            onDelete={(item) => deletePackingItem({ id: item._id, userId })}
            onEdit={setEditingItem}
            onOpenTaskEditor={setEditorTaskId}
            swipeRef={swipeRef}
          />
        ) : null}

        {grouped.byDate.map(([date, dateItems]) => (
          <PackingSection
            key={date}
            title={date}
            items={dateItems}
            onToggle={(item) => updateItem({ id: item._id, userId, checked: !item.checked })}
            onDelete={(item) => deletePackingItem({ id: item._id, userId })}
            onEdit={setEditingItem}
            onOpenTaskEditor={setEditorTaskId}
            swipeRef={swipeRef}
          />
        ))}
      </ScrollView>

      <Modal
        visible={newItemOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setNewItemOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-kyar-text/20 dark:bg-kyar-dark-text/20"
          onPress={() => setNewItemOpen(false)}
        >
          <Pressable
            className="rounded-t-[32px] bg-kyar-bg px-5 pb-8 pt-5 dark:bg-kyar-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <SectionHeading
              eyebrow={t("conventions.packingEyebrow")}
              title={t("conventions.addPackingAction")}
            />
            <View className="mt-4 gap-4">
              <TextField
                label="Label"
                value={newItemLabel}
                onChangeText={setNewItemLabel}
                placeholder={t("conventions.packingLabelPlaceholder")}
              />
              <TextField
                label="Notes"
                value={newItemNotes}
                onChangeText={setNewItemNotes}
                placeholder={t("conventions.packingNotesPlaceholder")}
                multiline
                numberOfLines={3}
                className="min-h-[88px]"
              />
              <Button
                title={t("conventions.addPackingAction")}
                onPress={() => void saveManualItem()}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingItem(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-kyar-text/20 dark:bg-kyar-dark-text/20"
          onPress={() => setEditingItem(null)}
        >
          <Pressable
            className="rounded-t-[32px] bg-kyar-bg px-5 pb-8 pt-5 dark:bg-kyar-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <SectionHeading
              eyebrow={t("conventions.packingEyebrow")}
              title={t("conventions.editPackingAction")}
            />
            {editingItem ? (
              <View className="mt-4 gap-4">
                <TextField
                  label="Label"
                  value={editingItem.label}
                  onChangeText={(value) => setEditingItem({ ...editingItem, label: value })}
                />
                <TextField
                  label="Date"
                  value={editingItem.date ?? ""}
                  onChangeText={(value) =>
                    setEditingItem({ ...editingItem, date: value || undefined })
                  }
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextField
                  label="Notes"
                  value={editingItem.notes ?? ""}
                  onChangeText={(value) =>
                    setEditingItem({ ...editingItem, notes: value || undefined })
                  }
                  multiline
                  numberOfLines={3}
                  className="min-h-[88px]"
                />
                <Button title={t("conventions.saveAction")} onPress={() => void saveEditedItem()} />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <WorkflowTaskEditorModal
        visible={editorTaskId !== null}
        workflowItemId={editorTaskId}
        userId={userId}
        candidateTasks={editorCandidates}
        onClose={() => setEditorTaskId(null)}
      />
    </>
  );
}

function PackingSection({
  title,
  items,
  onToggle,
  onDelete,
  onEdit,
  onOpenTaskEditor,
  swipeRef,
}: {
  title: string;
  items: ConventionPackingItem[];
  onToggle: (item: ConventionPackingItem) => void;
  onDelete: (item: ConventionPackingItem) => void;
  onEdit: (item: ConventionPackingItem) => void;
  onOpenTaskEditor: (id: Id<"workflowItems">) => void;
  swipeRef: MutableRefObject<Swipeable | null>;
}) {
  return (
    <SurfaceCard className="px-4 py-4">
      <MetaLabel>{title}</MetaLabel>
      <View className="mt-4 gap-3">
        {items.map((item) => (
          <PackingRow
            key={item._id}
            item={item}
            onToggle={() => onToggle(item)}
            onDelete={() => onDelete(item)}
            onEdit={() => onEdit(item)}
            onOpenTaskEditor={
              item.workflowItemId ? () => onOpenTaskEditor(item.workflowItemId!) : undefined
            }
            swipeRef={swipeRef}
          />
        ))}
      </View>
    </SurfaceCard>
  );
}

function PackingRow({
  item,
  onToggle,
  onDelete,
  onEdit,
  onOpenTaskEditor,
  swipeRef,
}: {
  item: ConventionPackingItem;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenTaskEditor?: () => void;
  swipeRef: MutableRefObject<Swipeable | null>;
}) {
  const { colors } = useDesignTheme();
  const isManual = item.entryKind === "manual";

  return (
    <Swipeable
      ref={(instance) => {
        if (instance) swipeRef.current = instance;
      }}
      renderRightActions={() => (
        <Pressable
          onPress={onToggle}
          className={`w-24 items-center justify-center rounded-3xl ${
            item.checked
              ? "bg-kyar-panel dark:bg-kyar-dark-panel"
              : "bg-kyar-text dark:bg-kyar-dark-text"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${item.checked ? "text-kyar-text dark:text-kyar-dark-text" : "text-kyar-bg dark:text-kyar-dark-bg"}`}
          >
            {item.checked ? "Undo" : "Done"}
          </Text>
        </Pressable>
      )}
      renderLeftActions={
        isManual
          ? () => (
              <Pressable
                onPress={onDelete}
                className="w-24 items-center justify-center rounded-3xl bg-kyar-danger/85"
              >
                <Text className="text-xs font-semibold text-white">Delete</Text>
              </Pressable>
            )
          : undefined
      }
    >
      <Pressable
        onPress={onToggle}
        onLongPress={onOpenTaskEditor ?? (isManual ? onEdit : undefined)}
        className="flex-row items-center gap-3 rounded-3xl border border-kyar-borderSubtle bg-kyar-surface px-4 py-4 active:opacity-90 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      >
        <View
          className={`h-9 w-9 items-center justify-center rounded-full border ${
            item.checked
              ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
              : "border-kyar-border dark:border-kyar-dark-border"
          }`}
        >
          {item.checked ? <Ionicons name="checkmark" size={16} color={colors.bg} /> : null}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
            {item.label}
          </Text>
          <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {item.notes
              ? item.notes
              : onOpenTaskEditor
                ? "Long-press for task details"
                : isManual
                  ? "Long-press to edit"
                  : "Swipe to mark packed"}
          </Text>
        </View>
        {onOpenTaskEditor || isManual ? (
          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
        ) : null}
      </Pressable>
    </Swipeable>
  );
}

function DayPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-3 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
    >
      <Text
        className={`text-xs font-semibold uppercase tracking-wide ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
