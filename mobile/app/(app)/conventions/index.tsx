import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { ConventionEventPoster } from "@/components/conventions/ConventionEventPoster";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  countPackingProgress,
  countPlannedBuilds,
  filterAndSortConventions,
  type ConventionFilter,
  type ConventionSortBy,
  type ConventionWithDetails,
  type SortOrder,
} from "@/screens/conventions/utils";
import {
  Button,
  DataBoundary,
  FloatingCreateMenu,
  MetaLabel,
  SectionHeading,
  SurfaceCard,
} from "@/ui";

const FILTER_KEYS: ConventionFilter[] = ["all", "upcoming", "past", "archived"];
const SORT_KEYS: ConventionSortBy[] = ["startDate", "name", "location"];

type Ready = {
  conventions: ConventionWithDetails[];
};

export default function ConventionsIndexScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const conventions = useOfflineQuery(
    api.conventions.listWithDetails,
    userId ? { userId } : "skip"
  );

  const loading = identity === undefined || (userId != null && conventions === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || (conventions ?? []).length === 0) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready"
      ? { conventions: (conventions ?? []) as ConventionWithDetails[] }
      : undefined;

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: t("nav.events"), headerLargeTitle: false }}
      />
      <DataBoundary status={status} data={data} error={error} empty={<EmptyConventionState />}>
        {(loaded) =>
          userId ? <ConventionsBody userId={userId} conventions={loaded.conventions} /> : null
        }
      </DataBoundary>
    </>
  );
}

type ConventionsBodyProps = {
  userId: string;
  conventions: ConventionWithDetails[];
};

function ConventionsBody({ userId, conventions }: ConventionsBodyProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useDesignTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConventionFilter>("all");
  const [sortBy, setSortBy] = useState<ConventionSortBy>("startDate");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [deletedForUndo, setDeletedForUndo] = useState<{
    count: number;
    payloads: Array<{
      userId: string;
      name: string;
      location?: string;
      imageUrl?: string;
      imageStorageId?: Doc<"conventions">["imageStorageId"];
      startDate: string;
      endDate: string;
    }>;
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const archiveMany = useOfflineMutation(api.conventions.archiveMany);
  const removeMany = useOfflineMutation(api.conventions.removeMany);
  const createConvention = useOfflineMutation(api.conventions.create);

  const filtered = useMemo(
    () => filterAndSortConventions(conventions, search, filter, sortBy, order),
    [conventions, filter, order, search, sortBy]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInModal = useCallback(() => {
    setSelectedIds((prev) => {
      if (filtered.length === 0) return prev;
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((c) => String(c._id)));
    });
  }, [filtered]);

  useEffect(
    () => () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    },
    []
  );

  const UNDO_WINDOW_MS = 8000;

  const handleArchiveSelected = useCallback(
    async (archived: boolean) => {
      if (selectedIds.size === 0) return;
      setBulkPending(true);
      try {
        await archiveMany({
          ids: Array.from(selectedIds) as Id<"conventions">[],
          userId,
          archived,
        });
        clearSelection();
        setBulkOpen(false);
      } catch (error) {
        Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
      } finally {
        setBulkPending(false);
      }
    },
    [archiveMany, clearSelection, selectedIds, t, userId]
  );

  const runBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const toDelete = conventions.filter((c) => selectedIds.has(String(c._id)));
    const payloads = toDelete.map((c) => ({
      userId: c.userId,
      name: c.name,
      location: c.location,
      imageUrl: c.imageUrl,
      imageStorageId: c.imageStorageId,
      startDate: c.startDate,
      endDate: c.endDate,
    }));
    setBulkPending(true);
    try {
      await removeMany({
        ids: Array.from(selectedIds) as Id<"conventions">[],
        userId,
      });
      clearSelection();
      setBulkOpen(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setDeletedForUndo({ count: payloads.length, payloads });
      undoTimeoutRef.current = setTimeout(() => {
        setDeletedForUndo(null);
        undoTimeoutRef.current = null;
      }, UNDO_WINDOW_MS);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setBulkPending(false);
    }
  }, [clearSelection, conventions, removeMany, selectedIds, t, userId]);

  const confirmBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t("conventions.bulkDeleteConfirmTitle", { count: selectedIds.size }),
      t("conventions.bulkDeleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("conventions.bulkDeleteConfirmAction"),
          style: "destructive",
          onPress: () => void runBulkDelete(),
        },
      ]
    );
  }, [runBulkDelete, selectedIds.size, t]);

  const handleUndoDelete = useCallback(async () => {
    if (!deletedForUndo) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setBulkPending(true);
    try {
      for (const payload of deletedForUndo.payloads) {
        await createConvention({
          userId: payload.userId,
          name: payload.name,
          location: payload.location,
          imageUrl: payload.imageUrl,
          imageStorageId: payload.imageStorageId,
          startDate: payload.startDate,
          endDate: payload.endDate,
        });
      }
      setDeletedForUndo(null);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setBulkPending(false);
    }
  }, [createConvention, deletedForUndo, t]);

  const dismissBulkModal = useCallback(() => {
    setBulkOpen(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  }, []);

  const createActions = useMemo(() => buildGlobalAddMenuActions("events", t, router), [router, t]);

  const filterSummary = [
    t(`conventions.filter.${filter}`),
    t(`conventions.sort.${sortBy}`),
    order === "asc" ? t("conventions.order.asc") : t("conventions.order.desc"),
  ].join(" · ");

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: deletedForUndo ? 200 : 132,
          gap: 16,
        }}
        ListHeaderComponent={
          <View className="gap-4">
            <View className="min-w-0">
              <Text className="text-[11px] text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("conventions.eyebrow")}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("conventions.subtitle")}
              </Text>
            </View>

            <SurfaceCard className="px-4 py-4">
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("conventions.searchPlaceholder")}
                placeholderTextColor={colors.textTertiary}
                className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />

              <Pressable
                onPress={() => setFiltersOpen((value) => !value)}
                className="mt-4 flex-row items-center justify-between rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                    {t("conventions.controls")}
                  </Text>
                  <Text
                    className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                    numberOfLines={2}
                  >
                    {filterSummary}
                  </Text>
                </View>
                <Ionicons
                  name={filtersOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              {filtersOpen ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mt-4"
                    contentContainerClassName="gap-2"
                  >
                    {FILTER_KEYS.map((value) => (
                      <ChoicePill
                        key={value}
                        active={filter === value}
                        label={t(`conventions.filter.${value}`)}
                        onPress={() => setFilter(value)}
                      />
                    ))}
                  </ScrollView>
                  <View className="mt-4 flex-row flex-wrap gap-2">
                    <ControlPill
                      label={t(`conventions.sort.${sortBy}`)}
                      onPress={() =>
                        setSortBy(
                          (value) => SORT_KEYS[(SORT_KEYS.indexOf(value) + 1) % SORT_KEYS.length]!
                        )
                      }
                    />
                    <ControlPill
                      label={
                        order === "asc" ? t("conventions.order.asc") : t("conventions.order.desc")
                      }
                      onPress={() => setOrder((value) => (value === "asc" ? "desc" : "asc"))}
                    />
                  </View>
                </>
              ) : null}
            </SurfaceCard>

            <View className="flex-row items-center justify-between gap-3">
              <MetaLabel className="min-w-0 flex-1">
                {t("conventions.resultsCount", {
                  count: filtered.length,
                })}
              </MetaLabel>
              <Pressable
                onPress={() => setBulkOpen(true)}
                className="shrink-0 rounded-full border border-kyar-borderSubtle px-3 py-2 dark:border-kyar-dark-borderSubtle"
              >
                <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                  {t("conventions.bulkSelectAction")}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const plannedBuilds = countPlannedBuilds(item.plans);
          const packing = countPackingProgress(item.packing);
          return (
            <Pressable
              onPress={() => router.push(APP_HREF.convention(item._id))}
              className="active:opacity-95"
            >
              <ConventionEventPoster
                name={item.name}
                startDate={item.startDate}
                endDate={item.endDate}
                location={item.location}
                imageStorageId={item.imageStorageId}
                imageUrl={item.imageUrl}
                plannedBuilds={plannedBuilds}
                packingChecked={packing.checked}
                packingTotal={packing.total}
                metricBuildsLabel={t("conventions.metricBuilds")}
                metricPackingLabel={t("conventions.metricPacking")}
                metricDaysLabel={t("conventions.metricDays")}
              />
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View className="h-4" />}
      />

      <FloatingCreateMenu actions={createActions} />

      <Modal visible={bulkOpen} animationType="slide" transparent onRequestClose={dismissBulkModal}>
        <View className="flex-1">
          <Pressable
            className="flex-1 justify-end bg-kyar-text/25 dark:bg-kyar-dark-text/25"
            onPress={dismissBulkModal}
          >
            <Pressable
              className="max-h-[88%] rounded-t-[28px] border border-kyar-borderSubtle bg-kyar-bg px-5 pb-10 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-bg"
              onPress={(event) => event.stopPropagation()}
            >
              <SectionHeading eyebrow={t("nav.events")} title={t("conventions.bulkModalTitle")} />
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("conventions.bulkModalBody")}
              </Text>

              <View className="mt-4 flex-row flex-wrap gap-2">
                <Pressable
                  onPress={selectAllInModal}
                  className="rounded-full border border-kyar-text bg-kyar-text px-4 py-2 dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                >
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
                    {selectedIds.size === filtered.length && filtered.length > 0
                      ? t("conventions.bulkDeselectAll")
                      : t("conventions.bulkSelectAll")}
                  </Text>
                </Pressable>
                <Pressable onPress={clearSelection} className="rounded-full px-4 py-2">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                    {t("conventions.bulkClear")}
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                className="mt-4 max-h-[42%] rounded-2xl border border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle"
                nestedScrollEnabled
              >
                {filtered.map((c) => {
                  const id = String(c._id);
                  const selected = selectedIds.has(id);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => toggleSelect(id)}
                      className="flex-row items-center gap-3 border-b border-kyar-borderSubtle px-3 py-3 dark:border-kyar-dark-borderSubtle"
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={22}
                        color={selected ? colors.text : colors.textTertiary}
                      />
                      <View className="min-w-0 flex-1">
                        <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                          {c.name}
                        </Text>
                        <Text className="mt-1 text-[10px] uppercase tracking-wide text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                          {c.startDate} – {c.endDate}
                          {c.location ? ` · ${c.location}` : ""}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text className="mt-3 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                {t("conventions.bulkSelectedCount", { count: selectedIds.size })}
              </Text>

              {selectedIds.size > 0 ? (
                <View className="mt-4 flex-row flex-wrap gap-2 border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
                  {filter !== "archived" ? (
                    <Button
                      title={t("conventions.bulkArchive")}
                      variant="secondary"
                      loading={bulkPending}
                      onPress={() => void handleArchiveSelected(true)}
                    />
                  ) : (
                    <Button
                      title={t("conventions.bulkUnarchive")}
                      variant="secondary"
                      loading={bulkPending}
                      onPress={() => void handleArchiveSelected(false)}
                    />
                  )}
                  <Pressable
                    onPress={confirmBulkDelete}
                    disabled={bulkPending}
                    className="rounded-xl border border-kyar-danger/40 px-4 py-3 disabled:opacity-40"
                  >
                    <Text className="text-center text-sm font-semibold text-kyar-danger dark:text-kyar-dark-danger">
                      {t("conventions.bulkDelete")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Button
                title={t("conventions.bulkDone")}
                variant="primary"
                className="mt-6"
                onPress={dismissBulkModal}
              />
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {deletedForUndo ? (
        <View className="absolute bottom-28 left-4 right-4 z-20 flex-row items-center justify-between gap-3 rounded-2xl border border-kyar-border bg-kyar-text px-4 py-3 dark:border-kyar-dark-border dark:bg-kyar-dark-text">
          <Text className="min-w-0 flex-1 text-sm font-medium text-kyar-bg dark:text-kyar-dark-bg">
            {t("conventions.bulkUndoDeleted", { count: deletedForUndo.count })}
          </Text>
          <Pressable
            onPress={() => void handleUndoDelete()}
            disabled={bulkPending}
            className="rounded-full border border-kyar-bg/40 px-3 py-2 dark:border-kyar-dark-bg/40"
          >
            <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
              {bulkPending ? t("conventions.bulkUndoing") : t("conventions.bulkUndoAction")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function EmptyConventionState() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 bg-kyar-bg px-5 py-8 dark:bg-kyar-dark-bg">
      <SurfaceCard className="px-5 py-6">
        <SectionHeading eyebrow={t("conventions.eyebrow")} title={t("conventions.emptyTitle")} />
        <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("conventions.emptyBody")}
        </Text>
        <Pressable
          onPress={() => router.push(APP_HREF.conventionNew)}
          className="mt-5 rounded-full bg-kyar-text px-4 py-3 dark:bg-kyar-dark-text"
        >
          <Text className="text-center font-semibold text-kyar-bg dark:text-kyar-dark-bg">
            {t("conventions.createAction")}
          </Text>
        </Pressable>
      </SurfaceCard>
    </View>
  );
}

function ChoicePill({
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
      className={`min-h-[40px] justify-center rounded-full border px-4 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
    >
      <Text
        className={`text-xs font-semibold uppercase tracking-wide ${
          active
            ? "text-kyar-bg dark:text-kyar-dark-bg"
            : "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ControlPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
    >
      <Text className="text-xs font-semibold text-kyar-text dark:text-kyar-dark-text">{label}</Text>
    </Pressable>
  );
}
