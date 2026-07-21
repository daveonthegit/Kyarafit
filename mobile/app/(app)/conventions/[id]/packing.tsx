import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { WorkflowTaskEditorModal } from "@/components/workflow/WorkflowTaskEditorModal";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassPanel, GlassTextField, PhotoBackdrop } from "@/ui/glass";
import {
  enumerateConventionDays,
  formatLongDateLabel,
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

function metaTextStyle(size: number, tracking: number, color: string) {
  return {
    fontFamily: APP_FONT_FAMILIES.sansBold,
    fontSize: size,
    letterSpacing: ls(tracking, size),
    textTransform: "uppercase" as const,
    color,
  };
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
  const [newItemLabel, setNewItemLabel] = useState("");
  const [editingItem, setEditingItem] = useState<ConventionPackingItem | null>(null);
  const [editorTaskId, setEditorTaskId] = useState<Id<"workflowItems"> | null>(null);
  const swipeRef = useRef<Swipeable | null>(null);

  const visibleItems = useMemo(() => {
    if (selectedDay === "all") return items;
    return items.filter((item) => item.date === selectedDay || !item.date);
  }, [items, selectedDay]);

  const grouped = useMemo(() => groupPackingByDate(visibleItems), [visibleItems]);
  const packedCount = useMemo(() => items.filter((item) => item.checked).length, [items]);
  const packingPct = items.length > 0 ? Math.round((100 * packedCount) / items.length) : 0;
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
        date: selectedDay === "all" ? undefined : selectedDay,
      });
      setNewItemLabel("");
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  }, [addManualPackingItem, convention._id, newItemLabel, selectedDay, t, userId]);

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

  const renderGroup = (heading: string, groupItems: ConventionPackingItem[], first: boolean) => (
    <View key={heading} style={{ marginTop: first ? 0 : 20 }}>
      {/* Group header: 9px/700/ls(0.2)/55% over a hairline (ref 8a). */}
      <Text
        style={[
          metaTextStyle(9, 0.2, glass.text.fg55),
          {
            paddingBottom: 6,
            borderBottomWidth: borderWidth.hairline,
            borderBottomColor: glass.border.divider,
          },
        ]}
      >
        {heading}
      </Text>
      {groupItems.map((item, index) => (
        <PackingRow
          key={item._id}
          item={item}
          first={index === 0}
          onToggle={() => updateItem({ id: item._id, userId, checked: !item.checked })}
          onDelete={() => deletePackingItem({ id: item._id, userId })}
          onEdit={() => setEditingItem(item)}
          onOpenTaskEditor={
            item.workflowItemId ? () => setEditorTaskId(item.workflowItemId!) : undefined
          }
          swipeRef={swipeRef}
        />
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop
        imageStorageId={convention.imageStorageId}
        imageUrl={convention.imageUrl}
        kenBurns={false}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <View style={{ paddingHorizontal: 22 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontStyle: "italic",
              fontSize: 34,
              lineHeight: 38,
              color: glass.text.fg,
            }}
          >
            {t("conventions.packingEyebrow")}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 13,
              lineHeight: 19,
              color: glass.text.fg70,
            }}
          >
            {t("conventions.packingSubtitle")}
          </Text>
        </View>

        {/* Day filter — segmented chips (active = solid light + ink; QA-3 exemption). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 16 }}
          contentContainerStyle={{ paddingHorizontal: 22, gap: 8 }}
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

        {/* The ONE glass work panel (QA-4 packing anatomy). */}
        <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
          <GlassPanel>
            <View
              style={{
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderBottomWidth: borderWidth.hairline,
                borderBottomColor: glass.border.dividerStrong,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Text style={metaTextStyle(10, 0.24, glass.text.fg)}>
                  {`${t("conventions.packingListTitle", { defaultValue: "Packing list" })} · ${items.length}`}
                </Text>
                <Pressable
                  onPress={() => void regeneratePacking({ userId, conventionId: convention._id })}
                  hitSlop={10}
                  className="active:opacity-80"
                  style={{ minHeight: 32, justifyContent: "center" }}
                >
                  <Text
                    style={[
                      metaTextStyle(9, 0.16, glass.text.fg70),
                      {
                        borderBottomWidth: 1,
                        borderBottomColor: glass.border.strong,
                        paddingBottom: 2,
                      },
                    ]}
                  >
                    {t("conventions.regeneratePackingAction")}
                  </Text>
                </Pressable>
              </View>
              {items.length > 0 ? (
                <View
                  style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  {/* Progress hairline: 2px, solid-light fill. */}
                  <View
                    style={{
                      height: 2,
                      flex: 1,
                      borderRadius: 1,
                      backgroundColor: glass.border.default,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: 2,
                        width: `${packingPct}%`,
                        borderRadius: 1,
                        backgroundColor: glass.surface.solid,
                      }}
                    />
                  </View>
                  <Text style={metaTextStyle(9, 0.16, glass.text.fg55)}>
                    {t("conventions.packedCountMeta", {
                      defaultValue: "{{checked}} / {{total}} packed",
                      checked: packedCount,
                      total: items.length,
                    })}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
              {visibleItems.length === 0 ? (
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 13,
                    lineHeight: 19,
                    color: glass.text.fg55,
                  }}
                >
                  {t("conventions.noPackingItems")}
                </Text>
              ) : (
                <>
                  {grouped.general.length > 0
                    ? renderGroup(t("conventions.generalPacking"), grouped.general, true)
                    : null}
                  {grouped.byDate.map(([date, dateItems], index) =>
                    renderGroup(
                      formatLongDateLabel(date),
                      dateItems,
                      grouped.general.length === 0 && index === 0
                    )
                  )}
                </>
              )}
            </View>

            {/* Footer composer — preserves addManualPackingItem. */}
            <View
              style={{
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.dividerStrong,
                paddingHorizontal: 18,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ minWidth: 0, flex: 1 }}>
                <GlassTextField
                  value={newItemLabel}
                  onChangeText={setNewItemLabel}
                  placeholder={t("conventions.addPackingPlaceholder", {
                    defaultValue: "Add packing item…",
                  })}
                  onSubmitEditing={() => void saveManualItem()}
                  returnKeyType="done"
                />
              </View>
              <Pressable
                onPress={() => void saveManualItem()}
                disabled={!newItemLabel.trim()}
                hitSlop={8}
                accessibilityRole="button"
                className="active:opacity-80"
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  opacity: newItemLabel.trim() ? 1 : 0.4,
                }}
              >
                <Text
                  style={[
                    metaTextStyle(9, 0.16, glass.text.fg70),
                    {
                      borderBottomWidth: 1,
                      borderBottomColor: glass.border.strong,
                      paddingBottom: 2,
                    },
                  ]}
                >
                  {t("conventions.addPackingAction")}
                </Text>
              </Pressable>
            </View>
          </GlassPanel>
        </View>
      </ScrollView>

      {/* Edit item — heavier-glass sheet (keeps updatePackingItem). */}
      <Modal
        visible={editingItem !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingItem(null)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
          onPress={() => setEditingItem(null)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              borderTopLeftRadius: glass.radius.sheet,
              borderTopRightRadius: glass.radius.sheet,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.overlay,
              backgroundColor: glass.fallback.overlay,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 32,
            }}
          >
            <Text style={metaTextStyle(9, 0.2, glass.text.fg55)}>
              {t("conventions.packingEyebrow")}
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                fontStyle: "italic",
                fontSize: 24,
                lineHeight: 28,
                color: glass.text.fg,
              }}
            >
              {t("conventions.editPackingAction")}
            </Text>
            {editingItem ? (
              <View style={{ marginTop: 16, gap: 14 }}>
                <GlassTextField
                  label={t("conventions.fieldName")}
                  value={editingItem.label}
                  onChangeText={(value) => setEditingItem({ ...editingItem, label: value })}
                />
                <GlassTextField
                  label={t("conventions.fieldStartDate")}
                  value={editingItem.date ?? ""}
                  onChangeText={(value) =>
                    setEditingItem({ ...editingItem, date: value || undefined })
                  }
                  placeholder={t("conventions.fieldDatePlaceholder")}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <GlassTextField
                  label={t("conventions.packingNotesLabel", { defaultValue: "Notes" })}
                  value={editingItem.notes ?? ""}
                  onChangeText={(value) =>
                    setEditingItem({ ...editingItem, notes: value || undefined })
                  }
                  placeholder={t("conventions.packingNotesPlaceholder")}
                  multiline
                  numberOfLines={3}
                />
                <Pressable
                  onPress={() => void saveEditedItem()}
                  accessibilityRole="button"
                  className="active:opacity-80"
                  style={{
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    backgroundColor: glass.surface.solid,
                  }}
                >
                  <Text style={metaTextStyle(10, 0.16, glass.text.ink)}>
                    {t("conventions.saveAction")}
                  </Text>
                </Pressable>
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
    </View>
  );
}

function PackingRow({
  item,
  first,
  onToggle,
  onDelete,
  onEdit,
  onOpenTaskEditor,
  swipeRef,
}: {
  item: ConventionPackingItem;
  first: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenTaskEditor?: () => void;
  swipeRef: MutableRefObject<Swipeable | null>;
}) {
  const { t } = useTranslation();
  const isManual = item.entryKind === "manual";

  return (
    <Swipeable
      ref={(instance) => {
        if (instance) swipeRef.current = instance;
      }}
      renderRightActions={() => (
        <Pressable
          onPress={onToggle}
          className="active:opacity-80"
          style={{
            width: 88,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: item.checked ? glass.surface.active : glass.surface.solid,
          }}
        >
          <Text
            style={metaTextStyle(9, 0.16, item.checked ? glass.text.fg : glass.text.ink)}
          >
            {item.checked
              ? t("conventions.packedUndoAction", { defaultValue: "Undo" })
              : t("conventions.packedDoneAction", { defaultValue: "Packed" })}
          </Text>
        </Pressable>
      )}
      renderLeftActions={
        isManual
          ? () => (
              <Pressable
                onPress={onDelete}
                className="active:opacity-80"
                style={{
                  width: 88,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: glass.text.danger,
                  backgroundColor: glass.surface.bar,
                }}
              >
                <Text style={metaTextStyle(9, 0.16, glass.text.danger)}>
                  {t("conventions.bulkDelete")}
                </Text>
              </Pressable>
            )
          : undefined
      }
    >
      <Pressable
        onPress={onToggle}
        onLongPress={onOpenTaskEditor ?? (isManual ? onEdit : undefined)}
        delayLongPress={400}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        className="active:opacity-80"
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderTopWidth: first ? 0 : borderWidth.hairline,
          borderTopColor: glass.border.divider,
          paddingVertical: 10,
        }}
      >
        {/* Square checkbox: 18px, radius 4, 1.5px ring at 55%; checked = solid + ink. */}
        <View
          style={{
            height: 18,
            width: 18,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            borderWidth: item.checked ? 0 : 1.5,
            borderColor: glass.text.fg55,
            backgroundColor: item.checked ? glass.surface.solid : "transparent",
          }}
        >
          {item.checked ? <Ionicons name="checkmark" size={12} color={glass.text.ink} /> : null}
        </View>
        <View style={{ minWidth: 0, flex: 1 }}>
          {/* Sentence-case 13px body — content is never meta (QA-4). */}
          <Text
            numberOfLines={2}
            style={{
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 13,
              lineHeight: 18,
              color: item.checked ? glass.text.fg55 : glass.text.fg,
              textDecorationLine: item.checked ? "line-through" : "none",
            }}
          >
            {item.label}
          </Text>
          {item.notes ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontFamily: APP_FONT_FAMILIES.sansRegular,
                fontSize: 11,
                color: glass.text.fg55,
              }}
            >
              {item.notes}
            </Text>
          ) : null}
        </View>
        {onOpenTaskEditor || isManual ? (
          <Ionicons name="create-outline" size={16} color={glass.text.fg45} />
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className="active:opacity-80"
      style={{
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        paddingHorizontal: 16,
        backgroundColor: active ? glass.surface.solid : glass.surface.bar,
        borderWidth: active ? 0 : 1,
        borderColor: glass.border.default,
      }}
    >
      <Text style={metaTextStyle(9, 0.16, active ? glass.text.ink : glass.text.fg)}>{label}</Text>
    </Pressable>
  );
}
