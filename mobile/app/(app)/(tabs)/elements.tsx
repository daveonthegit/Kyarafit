import { useCallback, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import type { CosplayExplorerItem } from "@kyarafit/design-system/domain";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_OVERALL_BUCKETS,
  type CosplayNodeType,
} from "@kyarafit/design-system/types";
import {
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
  nodeMatchesSubstate,
} from "@kyarafit/design-system/domain";
import { ElementPortfolioCard } from "@/components/elements/ElementPortfolioCard";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { DataBoundary, FloatingCreateMenu, MetaLabel } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";

type SortKey = "name" | "category" | "cost" | "progress" | "bucket";
type ViewMode = "all" | "tree";
type HierarchyFilter = "all" | "hasChildren" | "hasIncomplete";
type SubstateFilter = "" | "to_buy" | "bought" | "wip" | "built" | "in_use" | "complete";
type TypeFilter = "all" | CosplayNodeType;
type BucketFilter = "all" | (typeof COSPLAY_OVERALL_BUCKETS)[number];
type CategoryFilter = "all" | (typeof COSPLAY_CATEGORIES)[number];

type ElementListRow = CosplayExplorerItem & { _id: Id<"cosplayNodes"> };
type ElementLayoutMode = "comfortable" | "compact" | "grid";

type ListReady = {
  rows: ElementListRow[];
  builds: Array<Doc<"builds"> & { tasksTotal: number; tasksChecked: number }>;
  userId: string;
};

const SUBSTATE_FILTERS: { value: SubstateFilter; key: string }[] = [
  { value: "", key: "elements.substateAll" },
  { value: "to_buy", key: "elements.substateToBuy" },
  { value: "bought", key: "elements.substateBought" },
  { value: "wip", key: "elements.substateWip" },
  { value: "built", key: "elements.substateBuilt" },
  { value: "in_use", key: "elements.substateInUse" },
  { value: "complete", key: "elements.substateComplete" },
];

const HIERARCHY_FILTERS: { value: HierarchyFilter; key: string }[] = [
  { value: "all", key: "elements.hierarchyAll" },
  { value: "hasChildren", key: "elements.hierarchyHasChildren" },
  { value: "hasIncomplete", key: "elements.hierarchyHasIncomplete" },
];

export default function ElementsScreen() {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [substateFilter, setSubstateFilter] = useState<SubstateFilter>("");
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const listArgs = useMemo(() => {
    if (!userId) return "skip" as const;
    const q = search.trim();
    return {
      userId,
      sortBy,
      order,
      rootsOnly: viewMode === "tree",
      ...(q ? { search: q } : {}),
      ...(typeFilter !== "all" ? { nodeType: typeFilter } : {}),
      ...(bucketFilter !== "all" ? { overallBucket: bucketFilter } : {}),
      ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
    };
  }, [bucketFilter, categoryFilter, order, search, sortBy, typeFilter, userId, viewMode]);

  const rows = useOfflineQuery(api.cosplayNodes.list, listArgs);
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");

  const loading =
    identity === undefined || (userId != null && (rows === undefined || builds === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else status = "ready";

  const data: ListReady | undefined =
    status === "ready" && userId
      ? {
          rows: (rows ?? []) as ElementListRow[],
          builds: builds ?? [],
          userId,
        }
      : undefined;

  const cycleSort = useCallback(() => {
    const orderList: SortKey[] = ["name", "category", "cost", "progress", "bucket"];
    const index = orderList.indexOf(sortBy);
    setSortBy(orderList[(index + 1) % orderList.length]!);
  }, [sortBy]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  return (
    <DataBoundary<ListReady> status={status} data={data} error={error}>
      {(loaded) => (
        <ElementsListBody
          loaded={loaded}
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          order={order}
          cycleSort={cycleSort}
          toggleOrder={() => setOrder((value) => (value === "asc" ? "desc" : "asc"))}
          viewMode={viewMode}
          setViewMode={setViewMode}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          bucketFilter={bucketFilter}
          setBucketFilter={setBucketFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          substateFilter={substateFilter}
          setSubstateFilter={setSubstateFilter}
          hierarchyFilter={hierarchyFilter}
          setHierarchyFilter={setHierarchyFilter}
          refreshing={refreshing}
          onRefresh={onRefresh}
          router={router}
          t={t}
          placeholderColor={colors.textTertiary}
        />
      )}
    </DataBoundary>
  );
}

function ElementsListBody({
  loaded,
  search,
  setSearch,
  sortBy,
  order,
  cycleSort,
  toggleOrder,
  viewMode,
  setViewMode,
  typeFilter,
  setTypeFilter,
  bucketFilter,
  setBucketFilter,
  categoryFilter,
  setCategoryFilter,
  substateFilter,
  setSubstateFilter,
  hierarchyFilter,
  setHierarchyFilter,
  refreshing,
  onRefresh,
  router,
  t,
  placeholderColor,
}: {
  loaded: ListReady;
  search: string;
  setSearch: (s: string) => void;
  sortBy: SortKey;
  order: "asc" | "desc";
  cycleSort: () => void;
  toggleOrder: () => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  typeFilter: TypeFilter;
  setTypeFilter: (v: TypeFilter) => void;
  bucketFilter: BucketFilter;
  setBucketFilter: (v: BucketFilter) => void;
  categoryFilter: CategoryFilter;
  setCategoryFilter: (v: CategoryFilter) => void;
  substateFilter: SubstateFilter;
  setSubstateFilter: (v: SubstateFilter) => void;
  hierarchyFilter: HierarchyFilter;
  setHierarchyFilter: (v: HierarchyFilter) => void;
  refreshing: boolean;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
  t: TFunction;
  placeholderColor: string;
}) {
  const { colors } = useDesignTheme();
  const { rows, builds, userId } = loaded;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<ElementLayoutMode>("comfortable");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);

  const removeMany = useOfflineMutation(api.cosplayNodes.removeMany);
  const addNodesToBuild = useOfflineMutation(api.builds.addNodesToBuild);
  const removeNodesFromBuild = useOfflineMutation(api.builds.removeNodesFromBuild);

  const cycleLayout = useCallback(() => {
    setLayout((mode) =>
      mode === "comfortable" ? "compact" : mode === "compact" ? "grid" : "comfortable"
    );
  }, []);

  const addMenuActions = useMemo(
    () => buildGlobalAddMenuActions("elements", t, router),
    [t, router]
  );

  const sortLabel =
    sortBy === "name"
      ? t("elements.sortName")
      : sortBy === "category"
        ? t("elements.sortCategory")
        : sortBy === "cost"
          ? t("elements.sortCost")
          : sortBy === "progress"
            ? t("elements.sortProgress")
            : t("elements.sortBucket");
  const orderLabel = order === "asc" ? t("builds.sortAsc") : t("builds.sortDesc");
  const viewModeLabel = viewMode === "all" ? t("elements.tabAll") : t("elements.tabTree");
  const layoutLabel =
    layout === "comfortable"
      ? t("builds.layoutComfortable")
      : layout === "compact"
        ? t("builds.layoutCompact")
        : t("builds.layoutGrid");

  const typeSummary =
    typeFilter === "all"
      ? null
      : typeFilter === "element"
        ? t("elements.typeElement")
        : t("elements.typeMaterial");
  const bucketSummary = bucketFilter === "all" ? null : formatOverallBucket(bucketFilter);
  const categorySummary = categoryFilter === "all" ? null : categoryFilter;
  const substateSummary =
    substateFilter === ""
      ? null
      : t(
          SUBSTATE_FILTERS.find((item) => item.value === substateFilter)?.key ??
            "elements.substateAll"
        );
  const hierarchySummary =
    hierarchyFilter === "all"
      ? null
      : t(
          HIERARCHY_FILTERS.find((item) => item.value === hierarchyFilter)?.key ??
            "elements.hierarchyAll"
        );

  const filteredRows = useMemo(() => {
    let next = rows;
    if (substateFilter) next = next.filter((row) => nodeMatchesSubstate(row, substateFilter));
    if (hierarchyFilter === "hasChildren") {
      next = next.filter((row) => (row.childCount ?? 0) > 0);
    } else if (hierarchyFilter === "hasIncomplete") {
      next = next.filter((row) => row.hasIncompleteDescendants);
    }
    return next;
  }, [hierarchyFilter, rows, substateFilter]);

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
      if (filteredRows.length === 0) return prev;
      if (prev.size === filteredRows.length) return new Set();
      return new Set(filteredRows.map((row) => String(row._id)));
    });
  }, [filteredRows]);

  const selectedNodeIds = useMemo(
    () => Array.from(selectedIds) as Id<"cosplayNodes">[],
    [selectedIds]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t("elements.bulkDeleteTitle", { count: selectedIds.size }),
      t("elements.bulkDeleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.bulkDelete"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBulkPending(true);
              try {
                await removeMany({ userId, ids: selectedNodeIds });
                clearSelection();
                setBulkOpen(false);
              } catch (error) {
                Alert.alert(
                  t("common.errorTitle"),
                  String(error instanceof Error ? error.message : error)
                );
              } finally {
                setBulkPending(false);
              }
            })();
          },
        },
      ]
    );
  }, [clearSelection, removeMany, selectedIds.size, selectedNodeIds, t, userId]);

  const handleAssignToBuild = useCallback(
    async (buildId: Id<"builds">) => {
      if (selectedNodeIds.length === 0) return;
      setBulkPending(true);
      try {
        await addNodesToBuild({ userId, buildId, cosplayNodeIds: selectedNodeIds });
        clearSelection();
        setAssignOpen(false);
        setBulkOpen(false);
      } catch (error) {
        Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
      } finally {
        setBulkPending(false);
      }
    },
    [addNodesToBuild, clearSelection, selectedNodeIds, t, userId]
  );

  const handleUnassignFromBuild = useCallback(
    async (buildId: Id<"builds">) => {
      if (selectedNodeIds.length === 0) return;
      setBulkPending(true);
      try {
        await removeNodesFromBuild({ userId, buildId, cosplayNodeIds: selectedNodeIds });
        clearSelection();
        setUnassignOpen(false);
        setBulkOpen(false);
      } catch (error) {
        Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
      } finally {
        setBulkPending(false);
      }
    },
    [clearSelection, removeNodesFromBuild, selectedNodeIds, t, userId]
  );

  const filterSummary = [
    viewModeLabel,
    typeSummary,
    bucketSummary,
    categorySummary,
    substateSummary,
    hierarchySummary,
    sortLabel,
    orderLabel,
    layoutLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <View className="px-5 pb-3 pt-4">
        <View className="w-full flex-row items-center gap-2 border-b border-kyar-border pb-2 dark:border-kyar-dark-border">
          <Ionicons
            name="search"
            size={18}
            color={colors.textTertiary}
            importantForAccessibility="no"
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("elements.searchPlaceholder")}
            placeholderTextColor={placeholderColor}
            className="min-h-[38px] flex-1 py-2 text-[13px] text-kyar-text dark:text-kyar-dark-text"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <Pressable
          onPress={() => setFiltersOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          className="mt-3 flex min-h-[42px] w-full flex-row items-center justify-between gap-3 rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 py-2 shadow-soft active:opacity-90 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
        >
          <View className="shrink-0 flex-row items-center gap-2">
            <Ionicons
              name="options-outline"
              size={16}
              color={colors.text}
              importantForAccessibility="no"
            />
            <Text
              style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
              className="text-[9px] uppercase tracking-[0.22em] text-kyar-text dark:text-kyar-dark-text"
              numberOfLines={1}
            >
              {t("elements.refineElements")}
            </Text>
          </View>
          <View className="min-w-0 flex-1 flex-row items-center justify-end gap-2">
            <Text
              className="flex-1 text-right text-[10px] text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
              numberOfLines={2}
            >
              {filterSummary}
            </Text>
            <Ionicons
              name={filtersOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.text}
            />
          </View>
        </Pressable>

        {filtersOpen ? (
          <View className="mt-3 rounded-[24px] border border-kyar-borderSubtle bg-kyar-surface p-3 shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface">
            <MetaLabel>{t("elements.filtersViewLabel")}</MetaLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2"
              contentContainerClassName="gap-2 pr-1"
            >
              <FilterChip
                active={viewMode === "all"}
                label={t("elements.tabAll")}
                onPress={() => setViewMode("all")}
              />
              <FilterChip
                active={viewMode === "tree"}
                label={t("elements.tabTree")}
                onPress={() => setViewMode("tree")}
              />
            </ScrollView>

            <View className="mt-5">
              <MetaLabel>{t("elements.filtersSortViewLabel")}</MetaLabel>
              <View className="mt-2 flex-row flex-wrap gap-2">
                <ControlPill label={sortLabel} onPress={cycleSort} />
                <ControlPill label={orderLabel} onPress={toggleOrder} />
                <ControlPill label={layoutLabel} onPress={cycleLayout} />
              </View>
            </View>

            <View className="mt-5">
              <MetaLabel>{t("elements.typeLabel")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  <FilterChip
                    active={typeFilter === "all"}
                    label={t("elements.filterAll")}
                    onPress={() => setTypeFilter("all")}
                  />
                  <FilterChip
                    active={typeFilter === "element"}
                    label={t("elements.typeElement")}
                    onPress={() => setTypeFilter("element")}
                  />
                  <FilterChip
                    active={typeFilter === "material"}
                    label={t("elements.typeMaterial")}
                    onPress={() => setTypeFilter("material")}
                  />
                </View>
              </ScrollView>
            </View>

            <View className="mt-5">
              <MetaLabel>{t("elements.sortBucket")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  <FilterChip
                    active={bucketFilter === "all"}
                    label={t("elements.filterAll")}
                    onPress={() => setBucketFilter("all")}
                  />
                  {COSPLAY_OVERALL_BUCKETS.map((bucket) => (
                    <FilterChip
                      key={bucket}
                      active={bucketFilter === bucket}
                      label={formatOverallBucket(bucket)}
                      onPress={() => setBucketFilter(bucket)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="mt-5">
              <MetaLabel>{t("elements.substateLabel")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  {SUBSTATE_FILTERS.map((option) => (
                    <FilterChip
                      key={option.value || "all"}
                      active={substateFilter === option.value}
                      label={t(option.key)}
                      onPress={() => setSubstateFilter(option.value)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="mt-5">
              <MetaLabel>{t("elements.hierarchyLabel")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  {HIERARCHY_FILTERS.map((option) => (
                    <FilterChip
                      key={option.value}
                      active={hierarchyFilter === option.value}
                      label={t(option.key)}
                      onPress={() => setHierarchyFilter(option.value)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="mt-5">
              <MetaLabel>{t("elements.categoryLabel")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  <FilterChip
                    active={categoryFilter === "all"}
                    label={t("elements.filterAll")}
                    onPress={() => setCategoryFilter("all")}
                  />
                  {COSPLAY_CATEGORIES.map((category) => (
                    <FilterChip
                      key={category}
                      active={categoryFilter === category}
                      label={category}
                      onPress={() => setCategoryFilter(category)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        key={layout}
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        data={filteredRows}
        numColumns={layout === "grid" ? 2 : 1}
        keyExtractor={(item) => item._id}
        columnWrapperStyle={layout === "grid" ? { gap: 12, paddingHorizontal: 20 } : undefined}
        contentContainerStyle={{
          paddingHorizontal: layout === "grid" ? 0 : 20,
          paddingTop: 8,
          paddingBottom: 132,
          gap: 12,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View className="pb-3">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="min-w-0 flex-1 text-[10px] uppercase tracking-widest text-kyar-meta opacity-60 dark:text-kyar-dark-meta">
                {filteredRows.length === 1
                  ? t("elements.countSingular", { count: filteredRows.length })
                  : t("elements.countPlural", { count: filteredRows.length })}
              </Text>
              {filteredRows.length > 0 ? (
                <Pressable
                  onPress={() => setBulkOpen(true)}
                  className="rounded-full border border-kyar-borderSubtle px-3 py-2 dark:border-kyar-dark-borderSubtle"
                >
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                    {t("elements.bulkSelectAction")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text className="mt-12 px-6 text-center text-kyar-meta dark:text-kyar-dark-meta">
            {search.trim() ? t("elements.emptySearch") : t("elements.empty")}
          </Text>
        }
        renderItem={({ item }) => {
          const pct = item.progressPercent ?? 0;
          const childrenN = item.childCount ?? 0;
          const progressLabel = t("elements.progressPercent", { pct });
          const childrenLabel = t("elements.childrenShort", { count: childrenN });
          return (
            <Pressable
              className={layout === "grid" ? "mb-3 flex-1" : "mb-3"}
              onPress={() => router.push(APP_HREF.element(item._id as string))}
            >
              <ElementPortfolioCard
                variant={layout}
                item={{
                  name: item.name,
                  category: item.category,
                  imageStorageId: item.imageStorageId,
                  imageUrl: item.imageUrl,
                  nodeType: item.nodeType,
                  progressPercent: pct,
                  childCount: childrenN,
                  typeBadge: formatNodeTypeLabel(item.nodeType),
                  statusBadge: formatNodeStatus(item),
                }}
                progressLabel={progressLabel.toUpperCase()}
                childrenLabel={childrenLabel.toUpperCase()}
              />
            </Pressable>
          );
        }}
      />

      <FloatingCreateMenu actions={addMenuActions} />

      <Modal
        visible={bulkOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBulkOpen(false)}
      >
        <View className="flex-1">
          <Pressable
            className="flex-1 justify-end bg-kyar-text/25"
            onPress={() => setBulkOpen(false)}
          >
            <Pressable
              className="max-h-[88%] rounded-t-[28px] border border-kyar-borderSubtle bg-kyar-bg px-5 pb-10 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-bg"
              onPress={(event) => event.stopPropagation()}
            >
              <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                {t("elements.bulkModalTitle")}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("elements.bulkModalBody")}
              </Text>
              <View className="mt-4 flex-row flex-wrap gap-2">
                <Pressable
                  onPress={selectAllInModal}
                  className="rounded-full border border-kyar-text bg-kyar-text px-4 py-2 dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                >
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
                    {selectedIds.size === filteredRows.length && filteredRows.length > 0
                      ? t("elements.bulkDeselectAll")
                      : t("elements.bulkSelectAll")}
                  </Text>
                </Pressable>
                <Pressable onPress={clearSelection} className="rounded-full px-4 py-2">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                    {t("elements.bulkClear")}
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                className="mt-4 max-h-[42%] rounded-2xl border border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle"
                nestedScrollEnabled
              >
                {filteredRows.map((item) => {
                  const selected = selectedIds.has(String(item._id));
                  return (
                    <Pressable
                      key={item._id}
                      onPress={() => toggleSelected(String(item._id))}
                      className="flex-row items-center gap-3 border-b border-kyar-borderSubtle px-3 py-3 dark:border-kyar-dark-borderSubtle"
                    >
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={22}
                        color={selected ? colors.text : colors.textTertiary}
                      />
                      <View className="min-w-0 flex-1">
                        <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                          {item.name}
                        </Text>
                        <Text className="mt-1 text-[10px] uppercase tracking-wide text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                          {formatNodeTypeLabel(item.nodeType)} · {formatNodeStatus(item)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text className="mt-3 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.bulkSelectedCount", { count: selectedIds.size })}
              </Text>

              {selectedIds.size > 0 ? (
                <View className="mt-4 flex-row flex-wrap gap-2 border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
                  <Pressable
                    onPress={() => setAssignOpen(true)}
                    disabled={bulkPending}
                    className="rounded-xl border border-kyar-text px-4 py-3 disabled:opacity-40 dark:border-kyar-dark-text"
                  >
                    <Text className="text-center text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                      {t("elements.bulkLink")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setUnassignOpen(true)}
                    disabled={bulkPending}
                    className="rounded-xl border border-kyar-borderSubtle px-4 py-3 disabled:opacity-40 dark:border-kyar-dark-borderSubtle"
                  >
                    <Text className="text-center text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                      {t("elements.bulkUnlink")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleBulkDelete}
                    disabled={bulkPending}
                    className="rounded-xl border border-kyar-danger/40 px-4 py-3 disabled:opacity-40"
                  >
                    <Text className="text-center text-sm font-semibold text-kyar-danger dark:text-kyar-dark-danger">
                      {t("elements.bulkDelete")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                onPress={() => setBulkOpen(false)}
                className="mt-6 rounded-full bg-kyar-text px-4 py-3 dark:bg-kyar-dark-text"
              >
                <Text className="text-center font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                  {t("elements.bulkDone")}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      <BuildPickerModal
        visible={assignOpen}
        title={t("elements.bulkLinkTitle")}
        actionLabel={t("elements.bulkLinkAction")}
        builds={builds}
        onClose={() => setAssignOpen(false)}
        onSelect={(buildId) => void handleAssignToBuild(buildId)}
      />
      <BuildPickerModal
        visible={unassignOpen}
        title={t("elements.bulkUnlinkTitle")}
        actionLabel={t("elements.bulkUnlinkAction")}
        builds={builds}
        onClose={() => setUnassignOpen(false)}
        onSelect={(buildId) => void handleUnassignFromBuild(buildId)}
      />
    </View>
  );
}

function BuildPickerModal({
  visible,
  title,
  actionLabel,
  builds,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  actionLabel: string;
  builds: Array<Doc<"builds"> & { tasksTotal: number; tasksChecked: number }>;
  onClose: () => void;
  onSelect: (buildId: Id<"builds">) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-kyar-text/25" onPress={onClose}>
        <Pressable
          className="max-h-[76%] rounded-t-[28px] border border-kyar-borderSubtle bg-kyar-bg px-5 pb-10 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-bg"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
            {title}
          </Text>
          <ScrollView className="mt-4 max-h-[420px]">
            {builds.map((build) => (
              <Pressable
                key={build._id}
                onPress={() => onSelect(build._id)}
                className="flex-row items-center justify-between gap-3 border-b border-kyar-borderSubtle px-1 py-4 dark:border-kyar-dark-borderSubtle"
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                    {build.name}
                  </Text>
                  {build.character ? (
                    <Text className="mt-1 text-xs text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                      {build.character}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                  {actionLabel}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ControlPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[40px] justify-center rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
    >
      <Text className="text-xs font-medium text-kyar-text dark:text-kyar-dark-text">{label}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[38px] justify-center rounded-full border px-4 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
