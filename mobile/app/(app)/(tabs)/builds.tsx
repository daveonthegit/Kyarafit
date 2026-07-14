import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { glass, ls, borderWidth } from "@kyarafit/design-system/rn";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { DataBoundary, FloatingCreateMenu } from "@/ui";
import {
  GlassEmptyState,
  GlassSheet,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
  scrimGradientProps,
} from "@/ui/glass";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import {
  buildListArgs,
  getTabFilterOptions,
  type SortBy,
  type SortOrder,
  type TabFilter,
} from "@/lib/buildsListArgs";

type BuildListRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
  myRole?: string | null;
};

/** Long labels for the bulk sheet summary (parity with web). */
const TAB_SUMMARY_I18N: Record<TabFilter, string> = {
  all: "builds.tabSummaryAll",
  current: "builds.tabSummaryCurrent",
  planning: "builds.tabSummaryPlanning",
  completed: "builds.tabSummaryCompleted",
  archived: "builds.tabSummaryArchived",
};

/** Short chip labels for the archive-grid filter row. */
const TAB_I18N: Record<TabFilter, string> = {
  all: "builds.tabAll",
  current: "builds.tabCurrent",
  planning: "builds.tabPlanning",
  completed: "builds.tabCompleted",
  archived: "builds.tabArchived",
};

const SORT_I18N: Record<SortBy, string> = {
  name: "builds.sortName",
  progress: "builds.sortProgress",
  targetDate: "builds.sortTargetDate",
  budget: "builds.sortBudget",
};

type ListReady = { rows: BuildListRow[]; sharedRows: BuildListRow[]; userId: string };
type ViewMode = "featured" | "grid";
type BuildStatusAction = "idea" | "wip" | "ready" | "archived";
type PagerEntry = { row: BuildListRow; shared: boolean };

const STATUS_ACTIONS: BuildStatusAction[] = ["idea", "wip", "ready", "archived"];
const MAX_PAGER_DOTS = 12;

function progressPercent(row: BuildListRow): number {
  if (!row.tasksTotal) return 0;
  return Math.round((row.tasksChecked / row.tasksTotal) * 100);
}

function padIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export default function BuildsScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [refreshing, setRefreshing] = useState(false);

  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const listArgs = useMemo(
    () =>
      buildListArgs({
        userId: userId ?? null,
        activeTab,
        search,
        sortBy,
        order,
      }),
    [activeTab, order, search, sortBy, userId]
  );

  const rows = useOfflineQuery(api.builds.list, listArgs);
  const sharedRows = useOfflineQuery(api.builds.listSharedWithUser, userId ? { userId } : "skip");

  const loading =
    identity === undefined || (userId != null && (rows === undefined || sharedRows === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else status = "ready";

  const data: ListReady | undefined =
    status === "ready" && userId
      ? { rows: rows ?? [], sharedRows: (sharedRows ?? []) as BuildListRow[], userId }
      : undefined;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const cycleSort = useCallback(() => {
    const orderList: SortBy[] = ["name", "targetDate", "progress", "budget"];
    const index = orderList.indexOf(sortBy);
    setSortBy(orderList[(index + 1) % orderList.length]!);
  }, [sortBy]);

  const toggleOrder = useCallback(() => {
    setOrder((value) => (value === "asc" ? "desc" : "asc"));
  }, []);

  return (
    <DataBoundary<ListReady> status={status} data={data} error={error}>
      {(loaded) => (
        <BuildsListBody
          loaded={loaded}
          t={t}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          order={order}
          cycleSort={cycleSort}
          toggleOrder={toggleOrder}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </DataBoundary>
  );
}

function BuildsListBody({
  loaded,
  t,
  activeTab,
  setActiveTab,
  search,
  setSearch,
  sortBy,
  order,
  cycleSort,
  toggleOrder,
  refreshing,
  onRefresh,
}: {
  loaded: ListReady;
  t: (key: string, opt?: Record<string, string | number>) => string;
  activeTab: TabFilter;
  setActiveTab: (v: TabFilter) => void;
  search: string;
  setSearch: (s: string) => void;
  sortBy: SortBy;
  order: SortOrder;
  cycleSort: () => void;
  toggleOrder: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { rows, sharedRows, userId } = loaded;
  const [viewMode, setViewMode] = useState<ViewMode>("featured");
  const [searchOpen, setSearchOpen] = useState(search.trim().length > 0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [deletedForUndo, setDeletedForUndo] = useState<{
    count: number;
    payloads: {
      userId: string;
      name: string;
      character?: string;
      status: string;
      notes?: string;
      imageUrl?: string;
      imageStorageId?: Doc<"builds">["imageStorageId"];
      budgetCents?: number;
      targetDate?: string;
    }[];
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFocusedBuild = useOfflineMutation(api.users.setFocusedBuild);
  const updateBuild = useOfflineMutation(api.builds.update);
  const duplicateBuild = useOfflineMutation(api.builds.duplicate);
  const updateStatusMany = useOfflineMutation(api.builds.updateStatusMany);
  const removeMany = useOfflineMutation(api.builds.removeMany);
  const createBuild = useOfflineMutation(api.builds.create);

  const visibleRows = useMemo(
    () => rows.filter((row) => !hiddenIds.has(row._id as string)),
    [hiddenIds, rows]
  );

  /** Featured pager pages: own builds first, then shared builds. */
  const pages = useMemo((): PagerEntry[] => {
    return [
      ...visibleRows.map((row) => ({ row, shared: false })),
      ...sharedRows.map((row) => ({ row, shared: true })),
    ];
  }, [sharedRows, visibleRows]);

  useEffect(() => {
    if (activeIndex >= pages.length) setActiveIndex(Math.max(0, pages.length - 1));
  }, [activeIndex, pages.length]);

  /** Bottom-strip tiles: every build except the currently featured page. */
  const stripEntries = useMemo(
    () => pages.filter((_, index) => index !== activeIndex),
    [activeIndex, pages]
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInModal = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleRows.length === 0) return prev;
      if (prev.size === visibleRows.length) return new Set();
      return new Set(visibleRows.map((build) => String(build._id)));
    });
  }, [visibleRows]);

  useEffect(
    () => () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    },
    []
  );

  const handleBulkStatus = useCallback(
    async (status: BuildStatusAction) => {
      if (selectedIds.size === 0) return;
      setBulkPending(true);
      try {
        await updateStatusMany({
          ids: Array.from(selectedIds) as Id<"builds">[],
          userId,
          status,
        });
        clearSelection();
        setBulkOpen(false);
      } catch (error) {
        Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
      } finally {
        setBulkPending(false);
      }
    },
    [clearSelection, selectedIds, t, updateStatusMany, userId]
  );

  const runBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const toDelete = rows.filter((row) => selectedIds.has(String(row._id)));
    const payloads = toDelete.map((row) => ({
      userId: row.userId,
      name: row.name,
      character: row.character,
      status: row.status,
      notes: row.notes,
      imageUrl: row.imageUrl,
      imageStorageId: row.imageStorageId,
      budgetCents: row.budgetCents,
      targetDate: row.targetDate,
    }));
    setBulkPending(true);
    try {
      await removeMany({ ids: Array.from(selectedIds) as Id<"builds">[], userId });
      clearSelection();
      setBulkOpen(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setDeletedForUndo({ count: payloads.length, payloads });
      undoTimeoutRef.current = setTimeout(() => {
        setDeletedForUndo(null);
        undoTimeoutRef.current = null;
      }, 8000);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setBulkPending(false);
    }
  }, [clearSelection, removeMany, rows, selectedIds, t, userId]);

  const confirmBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t("builds.bulkDeleteTitle", { count: selectedIds.size }),
      t("builds.bulkDeleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("builds.bulkDelete"),
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
        await createBuild({
          userId,
          name: payload.name,
          character: payload.character,
          status: payload.status,
          notes: payload.notes,
          imageUrl: payload.imageUrl,
          imageStorageId: payload.imageStorageId,
          budgetCents: payload.budgetCents,
          targetDate: payload.targetDate,
        });
      }
      setDeletedForUndo(null);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setBulkPending(false);
    }
  }, [createBuild, deletedForUndo, t, userId]);

  const addMenuActions = useMemo(() => buildGlobalAddMenuActions("builds", t, router), [t]);

  const showActions = useCallback(
    (item: BuildListRow) => {
      Alert.alert(t("builds.actionsTitle"), item.name, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("builds.actionFocus"),
          onPress: () => void setFocusedBuild({ buildId: item._id as Id<"builds"> }),
        },
        {
          text: t("builds.actionArchive"),
          style: "destructive",
          onPress: () => {
            setHiddenIds((state) => new Set(state).add(item._id as string));
            void (async () => {
              try {
                await updateBuild({
                  id: item._id,
                  userId,
                  status: "archived",
                });
              } catch {
                setHiddenIds((state) => {
                  const next = new Set(state);
                  next.delete(item._id as string);
                  return next;
                });
              }
            })();
          },
        },
        {
          text: t("builds.actionDuplicate"),
          onPress: () => {
            void (async () => {
              try {
                const newId = await duplicateBuild({
                  userId,
                  sourceBuildId: item._id,
                });
                router.push(APP_HREF.build(newId as string));
              } catch (e) {
                Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
              }
            })();
          },
        },
      ]);
    },
    [duplicateBuild, setFocusedBuild, t, updateBuild, userId]
  );

  const statusLabel = useCallback(
    (status: string) => t(`builds.status.${status}`, { defaultValue: status }),
    [t]
  );

  const openBuild = useCallback((id: string) => router.push(APP_HREF.build(id)), []);
  const openBoard = useCallback((id: string) => router.push(APP_HREF.buildTab(id, "board")), []);

  const tabOptions = getTabFilterOptions();
  const sortLabel = t(SORT_I18N[sortBy]);
  const orderLabel = order === "asc" ? t("builds.sortAsc") : t("builds.sortDesc");

  const chromeTop = insets.top + 10;
  const headlineTop = insets.top + 58 + (searchOpen ? 68 : 0);
  const searching = search.trim().length > 0;
  const emptyMessage = searching ? t("builds.emptySearch") : t("builds.empty");

  const emptyState = (
    <GlassEmptyState
      icon="construct-outline"
      message={emptyMessage}
      action={
        !searching ? (
          <PhotoPill
            variant="solid"
            icon="add"
            label={t("builds.startFirstBuild", { defaultValue: "Start your first build" })}
            onPress={() => router.push(APP_HREF.buildNew)}
          />
        ) : undefined
      }
    />
  );

  return (
    <View style={{ flex: 1 }}>
      {viewMode === "featured" ? (
        pages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <PhotoBackdrop scrim="off" kenBurns={false} />
            {emptyState}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={pages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(entry) => String(entry.row._id)}
              style={{ flex: 1 }}
              initialNumToRender={2}
              windowSize={3}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              renderItem={({ item, index }) => (
                <FeaturedPage
                  entry={item}
                  index={index}
                  pageCount={pages.length}
                  activeIndex={activeIndex}
                  width={width}
                  headlineTop={headlineTop}
                  t={t}
                  statusLabel={statusLabel}
                  onOpen={() => openBuild(String(item.row._id))}
                  onOpenBoard={() => openBoard(String(item.row._id))}
                  onLongPress={item.shared ? undefined : () => showActions(item.row)}
                />
              )}
            />
            {stripEntries.length > 0 ? (
              <ArchiveStrip
                label={t("builds.archiveEyebrow", {
                  count: stripEntries.length,
                  defaultValue: "The archive · {{count}}",
                })}
                entries={stripEntries}
                bottom={insets.bottom + 120}
                onOpen={openBuild}
              />
            ) : null}
          </View>
        )
      ) : (
        <View style={{ flex: 1 }}>
          <PhotoBackdrop scrim="off" kenBurns={false} />
          <FlatList
            key="archive-grid"
            data={visibleRows}
            numColumns={2}
            keyExtractor={(item) => item._id}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: headlineTop,
              paddingBottom: insets.bottom + 120,
              gap: 10,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={glass.text.fg}
              />
            }
            ListHeaderComponent={
              <ArchiveHeader
                t={t}
                count={visibleRows.length}
                tabOptions={tabOptions}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sortLabel={sortLabel}
                orderLabel={orderLabel}
                cycleSort={cycleSort}
                toggleOrder={toggleOrder}
                onSelect={visibleRows.length > 0 ? () => setBulkOpen(true) : undefined}
              />
            }
            ListEmptyComponent={emptyState}
            renderItem={({ item, index }) => (
              <ArchiveTile
                row={item}
                index={index}
                statusLabel={statusLabel}
                onPress={() => openBuild(String(item._id))}
                onLongPress={() => showActions(item)}
              />
            )}
            ListFooterComponent={
              sharedRows.length > 0 ? (
                <View style={{ marginTop: 28 }}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 9,
                      letterSpacing: ls(0.22, 9),
                      textTransform: "uppercase",
                      color: glass.text.fg,
                      opacity: 0.75,
                      marginBottom: 10,
                    }}
                  >
                    {t("builds.sharedWithYou", { count: sharedRows.length })}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {sharedRows.map((item, index) => (
                      <View key={item._id} style={{ width: (width - 32 - 10) / 2 }}>
                        <ArchiveTile
                          row={item}
                          index={index}
                          statusLabel={statusLabel}
                          onPress={() => openBuild(String(item._id))}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null
            }
          />
        </View>
      )}

      {/* Screen chrome: search + view toggle, top-right of the headline area. */}
      <View
        style={{
          position: "absolute",
          top: chromeTop,
          left: 22,
          right: 22,
        }}
        pointerEvents="box-none"
      >
        <View
          style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}
          pointerEvents="box-none"
        >
          <IconPill
            icon="search"
            active={searchOpen}
            accessibilityLabel={t("builds.searchToggle", { defaultValue: "Search builds" })}
            onPress={() => {
              if (searchOpen) setSearch("");
              setSearchOpen((open) => !open);
            }}
          />
          <IconPill
            icon={viewMode === "featured" ? "grid-outline" : "albums-outline"}
            accessibilityLabel={
              viewMode === "featured"
                ? t("builds.viewGridToggle", { defaultValue: "Switch to grid view" })
                : t("builds.viewFeaturedToggle", { defaultValue: "Switch to featured view" })
            }
            onPress={() => setViewMode((mode) => (mode === "featured" ? "grid" : "featured"))}
          />
        </View>
        {searchOpen ? (
          <View style={{ marginTop: 10 }}>
            <GlassTextField
              value={search}
              onChangeText={setSearch}
              placeholder={t("builds.searchPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}
      </View>

      <FloatingCreateMenu actions={addMenuActions} />

      <GlassSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        closeLabel={t("common.cancel")}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 22,
              lineHeight: 25,
              color: glass.text.fg,
            }}
          >
            {t("builds.bulkModalTitle")}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 12,
              lineHeight: 18,
              color: glass.text.fg70,
            }}
          >
            {t("builds.bulkModalBody")}
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <PhotoPill
              variant="outline"
              size="sm"
              label={
                selectedIds.size === visibleRows.length && visibleRows.length > 0
                  ? t("builds.bulkDeselectAll")
                  : t("builds.bulkSelectAll")
              }
              onPress={selectAllInModal}
            />
            <PhotoPill variant="text" size="sm" label={t("builds.bulkClear")} onPress={clearSelection} />
          </View>

          <View
            style={{
              marginTop: 14,
              maxHeight: 280,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.default,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <ScrollView nestedScrollEnabled>
              {visibleRows.map((item, rowIndex) => {
                const selected = selectedIds.has(String(item._id));
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => toggleSelected(String(item._id))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderBottomWidth: rowIndex === visibleRows.length - 1 ? 0 : borderWidth.hairline,
                      borderBottomColor: glass.border.divider,
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={22}
                      color={selected ? glass.text.fg : glass.text.fg45}
                    />
                    <View style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansMedium,
                          fontSize: 14,
                          color: glass.text.fg,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.14, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg55,
                        }}
                        numberOfLines={1}
                      >
                        {item.character ? `${item.character} · ` : ""}
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Text
            style={{
              marginTop: 10,
              fontFamily: APP_FONT_FAMILIES.sansSemiBold,
              fontSize: 9,
              letterSpacing: ls(0.14, 9),
              textTransform: "uppercase",
              color: glass.text.fg55,
            }}
          >
            {t("builds.bulkSelectedCount", { count: selectedIds.size })} ·{" "}
            {t(TAB_SUMMARY_I18N[activeTab])}
          </Text>

          {selectedIds.size > 0 ? (
            <View
              style={{
                marginTop: 14,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.divider,
                paddingTop: 14,
              }}
            >
              {STATUS_ACTIONS.map((status) => (
                <PhotoPill
                  key={status}
                  variant="outline"
                  size="sm"
                  disabled={bulkPending}
                  label={t(`builds.status.${status}`)}
                  onPress={() => void handleBulkStatus(status)}
                />
              ))}
              <Pressable
                onPress={confirmBulkDelete}
                disabled={bulkPending}
                accessibilityRole="button"
                style={{
                  minHeight: 34,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: borderWidth.hairline,
                  borderColor: glass.text.danger,
                  paddingHorizontal: 16,
                  opacity: bulkPending ? 0.25 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.16, 9),
                    textTransform: "uppercase",
                    color: glass.text.danger,
                  }}
                >
                  {t("builds.bulkDelete")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ marginTop: 18, alignItems: "center" }}>
            <PhotoPill variant="solid" label={t("builds.bulkDone")} onPress={() => setBulkOpen(false)} />
          </View>
        </View>
      </GlassSheet>

      {deletedForUndo ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 96,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderRadius: 14,
            borderWidth: borderWidth.hairline,
            borderColor: glass.border.overlay,
            backgroundColor: glass.fallback.overlay,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              minWidth: 0,
              flex: 1,
              fontFamily: APP_FONT_FAMILIES.sansMedium,
              fontSize: 12,
              color: glass.text.fg,
            }}
          >
            {t("builds.bulkUndoDeleted", { count: deletedForUndo.count })}
          </Text>
          <PhotoPill
            variant="text"
            size="sm"
            disabled={bulkPending}
            label={bulkPending ? t("builds.bulkUndoing") : t("builds.bulkUndoAction")}
            onPress={() => void handleUndoDelete()}
          />
        </View>
      ) : null}
    </View>
  );
}

/** One full-bleed pager page: the build's photo with headline, progress, actions. */
function FeaturedPage({
  entry,
  index,
  pageCount,
  activeIndex,
  width,
  headlineTop,
  t,
  statusLabel,
  onOpen,
  onOpenBoard,
  onLongPress,
}: {
  entry: PagerEntry;
  index: number;
  pageCount: number;
  activeIndex: number;
  width: number;
  headlineTop: number;
  t: (key: string, opt?: Record<string, string | number>) => string;
  statusLabel: (status: string) => string;
  onOpen: () => void;
  onOpenBoard: () => void;
  onLongPress?: () => void;
}) {
  const { row, shared } = entry;
  const pct = progressPercent(row);
  const eyebrowLead = shared
    ? t("builds.sharedEyebrow", { defaultValue: "Shared" })
    : t("builds.featuredEyebrow", { defaultValue: "Featured" });

  return (
    <View style={{ width, flex: 1 }}>
      <PhotoBackdrop
        imageStorageId={row.imageStorageId}
        imageUrl={row.imageUrl}
        focalX={row.imageFocalX}
        focalY={row.imageFocalY}
        kenBurns={index === activeIndex}
      />
      <Pressable
        onLongPress={onLongPress}
        disabled={!onLongPress}
        style={{ position: "absolute", left: 22, right: 22, top: headlineTop }}
      >
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 9,
            letterSpacing: ls(0.26, 9),
            textTransform: "uppercase",
            color: glass.text.fg,
            opacity: 0.75,
            marginBottom: 8,
          }}
        >
          {eyebrowLead} · {padIndex(index)} · {statusLabel(row.status)}
        </Text>
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 40,
            lineHeight: 44,
            letterSpacing: ls(-0.02, 40),
            color: glass.text.fg,
          }}
        >
          {row.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
          <View
            style={{
              flex: 1,
              maxWidth: 180,
              height: 2,
              borderRadius: 2,
              backgroundColor: glass.border.overlay,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${pct}%`,
                height: "100%",
                backgroundColor: glass.surface.solid,
              }}
            />
          </View>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansSemiBold,
              fontSize: 11,
              color: glass.text.fg,
            }}
          >
            {pct}%
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 }}>
          <PhotoPill
            variant="solid"
            label={t("builds.openBuild", { defaultValue: "Open build" })}
            onPress={onOpen}
          />
          <PhotoPill
            variant="outline"
            label={t("builds.openBoard", { defaultValue: "Board" })}
            onPress={onOpenBoard}
          />
        </View>
        <View
          style={{
            marginTop: 18,
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 5,
          }}
        >
          {pageCount <= MAX_PAGER_DOTS ? (
            Array.from({ length: pageCount }, (_, dot) => (
              <View
                key={dot}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: glass.text.fg,
                  opacity: dot === activeIndex ? 1 : 0.35,
                }}
              />
            ))
          ) : (
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                fontSize: 11,
                color: glass.text.fg70,
              }}
            >
              {activeIndex + 1} / {pageCount}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

/** Grid-mode header: archive eyebrow, filter tabs (underline-active), sort/order/select. */
function ArchiveHeader({
  t,
  count,
  tabOptions,
  activeTab,
  setActiveTab,
  sortLabel,
  orderLabel,
  cycleSort,
  toggleOrder,
  onSelect,
}: {
  t: (key: string, opt?: Record<string, string | number>) => string;
  count: number;
  tabOptions: { value: TabFilter; label: string }[];
  activeTab: TabFilter;
  setActiveTab: (v: TabFilter) => void;
  sortLabel: string;
  orderLabel: string;
  cycleSort: () => void;
  toggleOrder: () => void;
  onSelect?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 6, paddingBottom: 14 }}>
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 9,
          letterSpacing: ls(0.22, 9),
          textTransform: "uppercase",
          color: glass.text.fg,
          opacity: 0.75,
        }}
      >
        {t("builds.archiveEyebrow", { count, defaultValue: "The archive · {{count}}" })}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: 12 }}
        contentContainerStyle={{ gap: 14, paddingRight: 6 }}
      >
        {tabOptions.map((option) => {
          const active = activeTab === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setActiveTab(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                style={{
                  fontFamily: active ? APP_FONT_FAMILIES.sansBold : APP_FONT_FAMILIES.sansSemiBold,
                  fontSize: 9,
                  letterSpacing: ls(0.16, 9),
                  textTransform: "uppercase",
                  color: glass.text.fg,
                  opacity: active ? 1 : 0.55,
                  borderBottomWidth: 1.5,
                  borderBottomColor: active ? glass.text.fg : "transparent",
                  paddingBottom: 2,
                }}
              >
                {t(TAB_I18N[option.value])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 2 }}>
        <HeaderTextAction label={sortLabel} onPress={cycleSort} />
        <HeaderTextAction label={orderLabel} onPress={toggleOrder} />
        {onSelect ? <HeaderTextAction label={t("builds.bulkSelectAction")} onPress={onSelect} /> : null}
      </View>
    </View>
  );
}

function HeaderTextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
          fontSize: 9,
          letterSpacing: ls(0.14, 9),
          textTransform: "uppercase",
          color: glass.text.fg70,
          borderBottomWidth: 1,
          borderBottomColor: glass.border.strong,
          paddingBottom: 2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 2-col archive tile: photo, bottom scrim, serif name + 9px meta. */
function ArchiveTile({
  row,
  index,
  statusLabel,
  onPress,
  onLongPress,
}: {
  row: BuildListRow;
  index: number;
  statusLabel: (status: string) => string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const pct = progressPercent(row);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={row.name}
      style={{ flex: 1, height: 118, borderRadius: 10, overflow: "hidden" }}
    >
      <PhotoBackdrop
        imageStorageId={row.imageStorageId}
        imageUrl={row.imageUrl}
        focalX={row.imageFocalX}
        focalY={row.imageFocalY}
        scrim="off"
        kenBurns={false}
      />
      <LinearGradient
        colors={[glass.scrim.pageVerticalMobile.stops[0]!.color, "transparent"]}
        locations={[0, 0.6]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ position: "absolute", left: 10, right: 10, bottom: 8 }}>
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 14,
            lineHeight: 16,
            color: glass.text.fg,
          }}
          numberOfLines={1}
        >
          {row.name}
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontFamily: APP_FONT_FAMILIES.sansSemiBold,
            fontSize: 9,
            letterSpacing: ls(0.14, 9),
            textTransform: "uppercase",
            color: glass.text.fg70,
          }}
          numberOfLines={1}
        >
          {padIndex(index)} · {statusLabel(row.status)} · {pct}%
        </Text>
      </View>
    </Pressable>
  );
}

/** Featured-mode bottom strip: archive eyebrow + horizontal shelf of small photo tiles. */
function ArchiveStrip({
  label,
  entries,
  bottom,
  onOpen,
}: {
  label: string;
  entries: PagerEntry[];
  bottom: number;
  onOpen: (id: string) => void;
}) {
  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, bottom }}
      pointerEvents="box-none"
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 9,
          letterSpacing: ls(0.22, 9),
          textTransform: "uppercase",
          color: glass.text.fg,
          opacity: 0.75,
          marginBottom: 10,
          paddingHorizontal: 16,
        }}
      >
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
      >
        {entries.map((entry) => (
          <Pressable
            key={String(entry.row._id)}
            onPress={() => onOpen(String(entry.row._id))}
            accessibilityRole="button"
            accessibilityLabel={entry.row.name}
            className="active:opacity-80"
            style={{
              width: 116,
              height: 70,
              borderRadius: 9,
              overflow: "hidden",
              backgroundColor: glass.surface.active,
            }}
          >
            {entry.row.imageStorageId != null || entry.row.imageUrl != null ? (
              <ConvexStorageImage
                storageId={entry.row.imageStorageId ?? null}
                imageUrl={entry.row.imageUrl ?? null}
                className="absolute inset-0 h-full w-full"
                accessibilityLabel={entry.row.name}
              />
            ) : null}
            <LinearGradient
              {...scrimGradientProps(glass.scrim.pageVertical)}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={{ position: "absolute", left: 9, right: 9, bottom: 6 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontSize: 12,
                  lineHeight: 14,
                  color: glass.text.fg,
                }}
              >
                {entry.row.name}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** 44pt glass-outline icon pill (screen chrome). */
function IconPill({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      className="active:opacity-80"
      style={[
        {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: borderWidth.hairline,
          borderColor: active ? glass.border.strong : glass.border.overlay,
          backgroundColor: active ? glass.surface.overlay : glass.surface.bar,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={glass.text.fg} />
    </Pressable>
  );
}
