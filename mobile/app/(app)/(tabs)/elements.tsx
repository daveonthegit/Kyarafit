import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { glass, ls } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary, FloatingCreateMenu } from "@/ui";
import {
  GlassEmptyState,
  GlassPanel,
  GlassStatusChip,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
  scrimGradientProps,
  type GlassStatusTone,
} from "@/ui/glass";
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

type GridItem = { kind: "element"; row: ElementListRow } | { kind: "add" };

type ListReady = {
  rows: ElementListRow[];
  builds: (Doc<"builds"> & { tasksTotal: number; tasksChecked: number })[];
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

/** Status → on-glass chip tone (done=success, in-flight=active, else neutral). */
function nodeStatusTone(row: ElementListRow): GlassStatusTone {
  if (
    row.buildStatus === "built" ||
    row.materialStatus === "complete" ||
    row.overallBucket === "complete"
  ) {
    return "success";
  }
  if (
    row.buildStatus === "wip" ||
    row.materialStatus === "in_use" ||
    row.overallBucket === "in_progress"
  ) {
    return "active";
  }
  return "neutral";
}

export default function ElementsScreen() {
  const { t } = useTranslation();
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
    <View style={{ flex: 1 }}>
      <PhotoBackdrop scrim="off" kenBurns={false} />
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
          />
        )}
      </DataBoundary>
    </View>
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
}) {
  const insets = useSafeAreaInsets();
  const { rows, builds, userId } = loaded;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignOpen, setUnassignOpen] = useState(false);

  const removeMany = useOfflineMutation(api.cosplayNodes.removeMany);
  const addNodesToBuild = useOfflineMutation(api.builds.addNodesToBuild);
  const removeNodesFromBuild = useOfflineMutation(api.builds.removeNodesFromBuild);

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

  const gridItems = useMemo<GridItem[]>(
    () =>
      filteredRows.length === 0
        ? []
        : [
            ...filteredRows.map((row): GridItem => ({ kind: "element", row })),
            { kind: "add" },
          ],
    [filteredRows]
  );

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
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const openNewElement = useCallback(() => {
    router.push(APP_HREF.elementNew);
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 52 }}>
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 34,
            lineHeight: 38,
            letterSpacing: ls(-0.01, 34),
            color: glass.text.fg,
            marginBottom: 6,
          }}
        >
          {t("elements.closetTitle", { defaultValue: "The closet" })}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8, alignItems: "flex-end" }}
          style={{ marginBottom: 14, flexGrow: 0 }}
        >
          <CategoryChip
            active={categoryFilter === "all"}
            label={t("elements.filterAll")}
            onPress={() => setCategoryFilter("all")}
          />
          {COSPLAY_CATEGORIES.map((category) => (
            <CategoryChip
              key={category}
              active={categoryFilter === category}
              label={category}
              onPress={() => setCategoryFilter(category)}
            />
          ))}
        </ScrollView>

        <GlassTextField
          value={search}
          onChangeText={setSearch}
          placeholder={t("elements.searchPlaceholder")}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        <Pressable
          onPress={() => setFiltersOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          style={{
            marginTop: 10,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: glass.border.default,
            backgroundColor: glass.surface.field,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Ionicons
              name="options-outline"
              size={15}
              color={glass.text.fg}
              importantForAccessibility="no"
            />
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansBold,
                fontSize: 9,
                letterSpacing: ls(0.2, 9),
                textTransform: "uppercase",
                color: glass.text.fg,
              }}
              numberOfLines={1}
            >
              {t("elements.refineElements")}
            </Text>
          </View>
          <View
            style={{
              minWidth: 0,
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <Text
              style={{
                flex: 1,
                textAlign: "right",
                fontFamily: APP_FONT_FAMILIES.sansRegular,
                fontSize: 10,
                color: glass.text.fg55,
              }}
              numberOfLines={2}
            >
              {filterSummary}
            </Text>
            <Ionicons
              name={filtersOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={glass.text.fg}
            />
          </View>
        </Pressable>

        {filtersOpen ? (
          <GlassPanel blur={false} style={{ marginTop: 10, padding: 14 }}>
            <RefineSectionLabel>{t("elements.filtersViewLabel")}</RefineSectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 8 }}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              <GlassFilterChip
                active={viewMode === "all"}
                label={t("elements.tabAll")}
                onPress={() => setViewMode("all")}
              />
              <GlassFilterChip
                active={viewMode === "tree"}
                label={t("elements.tabTree")}
                onPress={() => setViewMode("tree")}
              />
            </ScrollView>

            <View style={{ marginTop: 18 }}>
              <RefineSectionLabel>{t("elements.filtersSortViewLabel")}</RefineSectionLabel>
              <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <GlassControlPill label={sortLabel} onPress={cycleSort} />
                <GlassControlPill label={orderLabel} onPress={toggleOrder} />
              </View>
            </View>

            <View style={{ marginTop: 18 }}>
              <RefineSectionLabel>{t("elements.typeLabel")}</RefineSectionLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                <GlassFilterChip
                  active={typeFilter === "all"}
                  label={t("elements.filterAll")}
                  onPress={() => setTypeFilter("all")}
                />
                <GlassFilterChip
                  active={typeFilter === "element"}
                  label={t("elements.typeElement")}
                  onPress={() => setTypeFilter("element")}
                />
                <GlassFilterChip
                  active={typeFilter === "material"}
                  label={t("elements.typeMaterial")}
                  onPress={() => setTypeFilter("material")}
                />
              </ScrollView>
            </View>

            <View style={{ marginTop: 18 }}>
              <RefineSectionLabel>{t("elements.sortBucket")}</RefineSectionLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                <GlassFilterChip
                  active={bucketFilter === "all"}
                  label={t("elements.filterAll")}
                  onPress={() => setBucketFilter("all")}
                />
                {COSPLAY_OVERALL_BUCKETS.map((bucket) => (
                  <GlassFilterChip
                    key={bucket}
                    active={bucketFilter === bucket}
                    label={formatOverallBucket(bucket)}
                    onPress={() => setBucketFilter(bucket)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={{ marginTop: 18 }}>
              <RefineSectionLabel>{t("elements.substateLabel")}</RefineSectionLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                {SUBSTATE_FILTERS.map((option) => (
                  <GlassFilterChip
                    key={option.value || "all"}
                    active={substateFilter === option.value}
                    label={t(option.key)}
                    onPress={() => setSubstateFilter(option.value)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={{ marginTop: 18 }}>
              <RefineSectionLabel>{t("elements.hierarchyLabel")}</RefineSectionLabel>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                {HIERARCHY_FILTERS.map((option) => (
                  <GlassFilterChip
                    key={option.value}
                    active={hierarchyFilter === option.value}
                    label={t(option.key)}
                    onPress={() => setHierarchyFilter(option.value)}
                  />
                ))}
              </ScrollView>
            </View>
          </GlassPanel>
        ) : null}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={gridItems}
        numColumns={2}
        keyExtractor={(item) => (item.kind === "add" ? "add-tile" : item.row._id)}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 20 }}
        contentContainerStyle={{
          paddingTop: 8,
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
          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text
              style={{
                minWidth: 0,
                flex: 1,
                fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                fontSize: 9,
                letterSpacing: ls(0.16, 9),
                textTransform: "uppercase",
                color: glass.text.fg55,
              }}
            >
              {filteredRows.length === 1
                ? t("elements.countSingular", { count: filteredRows.length })
                : t("elements.countPlural", { count: filteredRows.length })}
            </Text>
            {filteredRows.length > 0 ? (
              <Pressable
                onPress={() => setBulkOpen(true)}
                accessibilityRole="button"
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: glass.border.default,
                  paddingHorizontal: 14,
                }}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.16, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg,
                  }}
                >
                  {t("elements.bulkSelectAction")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <GlassEmptyState
            icon="shirt-outline"
            message={
              search.trim()
                ? t("elements.emptySearch")
                : t("elements.closetEmpty", {
                    defaultValue: "Your closet is empty. Add your first piece.",
                  })
            }
            secondary={search.trim() ? undefined : t("elements.empty")}
            action={
              search.trim() ? undefined : (
                <PhotoPill
                  variant="outline"
                  size="sm"
                  icon="add"
                  label={t("elements.newElementShort")}
                  onPress={openNewElement}
                />
              )
            }
          />
        }
        renderItem={({ item }) =>
          item.kind === "add" ? (
            <AddElementTile label={t("elements.newElementShort")} onPress={openNewElement} />
          ) : (
            <ElementClosetTile
              row={item.row}
              onPress={() => router.push(APP_HREF.element(item.row._id as string))}
            />
          )
        }
      />

      <FloatingCreateMenu actions={addMenuActions} />

      <Modal
        visible={bulkOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setBulkOpen(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
            onPress={() => setBulkOpen(false)}
          >
            <Pressable
              style={{
                maxHeight: "88%",
                borderTopLeftRadius: glass.radius.sheet,
                borderTopRightRadius: glass.radius.sheet,
                borderWidth: 1,
                borderColor: glass.border.overlay,
                backgroundColor: glass.fallback.overlay,
                paddingHorizontal: 20,
                paddingBottom: 40,
                paddingTop: 20,
              }}
              onPress={(event) => event.stopPropagation()}
            >
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontSize: 22,
                  color: glass.text.fg,
                }}
              >
                {t("elements.bulkModalTitle")}
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: APP_FONT_FAMILIES.sansRegular,
                  fontSize: 13,
                  lineHeight: 20,
                  color: glass.text.fg70,
                }}
              >
                {t("elements.bulkModalBody")}
              </Text>
              <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={selectAllInModal}
                  accessibilityRole="button"
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: glass.border.strong,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 10,
                      letterSpacing: ls(0.16, 10),
                      textTransform: "uppercase",
                      color: glass.text.fg,
                    }}
                  >
                    {selectedIds.size === filteredRows.length && filteredRows.length > 0
                      ? t("elements.bulkDeselectAll")
                      : t("elements.bulkSelectAll")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={clearSelection}
                  accessibilityRole="button"
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    borderRadius: 999,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 10,
                      letterSpacing: ls(0.16, 10),
                      textTransform: "uppercase",
                      color: glass.text.fg55,
                    }}
                  >
                    {t("elements.bulkClear")}
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={{
                  marginTop: 16,
                  maxHeight: "42%",
                  borderRadius: glass.radius.panel,
                  borderWidth: 1,
                  borderColor: glass.border.default,
                }}
                nestedScrollEnabled
              >
                {filteredRows.map((item) => {
                  const selected = selectedIds.has(String(item._id));
                  return (
                    <Pressable
                      key={item._id}
                      onPress={() => toggleSelected(String(item._id))}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: glass.border.divider,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        minHeight: 44,
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
                            fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                            fontSize: 14,
                            color: glass.text.fg,
                          }}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={{
                            marginTop: 3,
                            fontFamily: APP_FONT_FAMILIES.sansMedium,
                            fontSize: 9,
                            letterSpacing: ls(0.14, 9),
                            textTransform: "uppercase",
                            color: glass.text.fg55,
                          }}
                        >
                          {formatNodeTypeLabel(item.nodeType)} · {formatNodeStatus(item)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text
                style={{
                  marginTop: 12,
                  fontFamily: APP_FONT_FAMILIES.sansRegular,
                  fontSize: 12,
                  color: glass.text.fg55,
                }}
              >
                {t("elements.bulkSelectedCount", { count: selectedIds.size })}
              </Text>

              {selectedIds.size > 0 ? (
                <View
                  style={{
                    marginTop: 16,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    borderTopWidth: 1,
                    borderTopColor: glass.border.divider,
                    paddingTop: 16,
                  }}
                >
                  <Pressable
                    onPress={() => setAssignOpen(true)}
                    disabled={bulkPending}
                    accessibilityRole="button"
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: glass.border.strong,
                      paddingHorizontal: 16,
                      opacity: bulkPending ? 0.4 : 1,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                        fontSize: 13,
                        color: glass.text.fg,
                      }}
                    >
                      {t("elements.bulkLink")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setUnassignOpen(true)}
                    disabled={bulkPending}
                    accessibilityRole="button"
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: glass.border.default,
                      paddingHorizontal: 16,
                      opacity: bulkPending ? 0.4 : 1,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                        fontSize: 13,
                        color: glass.text.fg,
                      }}
                    >
                      {t("elements.bulkUnlink")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleBulkDelete}
                    disabled={bulkPending}
                    accessibilityRole="button"
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: glass.border.default,
                      paddingHorizontal: 16,
                      opacity: bulkPending ? 0.4 : 1,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                        fontSize: 13,
                        color: glass.text.danger,
                      }}
                    >
                      {t("elements.bulkDelete")}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                onPress={() => setBulkOpen(false)}
                accessibilityRole="button"
                style={{
                  marginTop: 24,
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: glass.border.strong,
                  paddingHorizontal: 16,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 10,
                    letterSpacing: ls(0.16, 10),
                    textTransform: "uppercase",
                    color: glass.text.fg,
                  }}
                >
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

/** Closet grid tile: photo, bottom scrim, status chip, meta + serif name (ref 6d). */
function ElementClosetTile({ row, onPress }: { row: ElementListRow; onPress: () => void }) {
  const status = formatNodeStatus(row);
  const metaParts = [formatNodeTypeLabel(row.nodeType), row.category?.trim() || null].filter(
    (part): part is string => Boolean(part)
  );
  const placeholderIcon =
    row.nodeType === "material" ? ("flask-outline" as const) : ("shirt-outline" as const);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.name}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 3 / 4,
        borderRadius: 11,
        overflow: "hidden",
        backgroundColor: glass.surface.field,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {row.imageStorageId || row.imageUrl ? (
        <ConvexStorageImage
          storageId={row.imageStorageId as Id<"_storage"> | undefined}
          imageUrl={row.imageUrl}
          className="h-full w-full"
          accessibilityLabel={row.name}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={placeholderIcon} size={40} color={glass.text.fg45} />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        {...scrimGradientProps(glass.scrim.pageVertical)}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {status ? (
        <View style={{ position: "absolute", left: 8, top: 8 }}>
          <GlassStatusChip tone={nodeStatusTone(row)} label={status} />
        </View>
      ) : null}
      <View style={{ position: "absolute", left: 10, right: 10, bottom: 9 }}>
        {metaParts.length > 0 ? (
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansSemiBold,
              fontSize: 9,
              letterSpacing: ls(0.14, 9),
              textTransform: "uppercase",
              color: glass.text.fg70,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {metaParts.join(" · ")}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 14,
            lineHeight: 17,
            color: glass.text.fg,
          }}
          numberOfLines={2}
        >
          {row.name}
        </Text>
      </View>
    </Pressable>
  );
}

/** Dashed "add" tile — the dashed border is reserved for add affordances. */
function AddElementTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 3 / 4,
        borderRadius: 11,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: glass.border.strong,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name="add" size={22} color={glass.text.fg70} />
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 9,
          letterSpacing: ls(0.16, 9),
          textTransform: "uppercase",
          color: glass.text.fg70,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
  builds: (Doc<"builds"> & { tasksTotal: number; tasksChecked: number })[];
  onClose: () => void;
  onSelect: (buildId: Id<"builds">) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
        onPress={onClose}
      >
        <Pressable
          style={{
            maxHeight: "76%",
            borderTopLeftRadius: glass.radius.sheet,
            borderTopRightRadius: glass.radius.sheet,
            borderWidth: 1,
            borderColor: glass.border.overlay,
            backgroundColor: glass.fallback.overlay,
            paddingHorizontal: 20,
            paddingBottom: 40,
            paddingTop: 20,
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 22,
              color: glass.text.fg,
            }}
          >
            {title}
          </Text>
          <ScrollView style={{ marginTop: 16, maxHeight: 420 }}>
            {builds.map((build) => (
              <Pressable
                key={build._id}
                onPress={() => onSelect(build._id)}
                accessibilityRole="button"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: glass.border.divider,
                  paddingHorizontal: 4,
                  paddingVertical: 16,
                  minHeight: 44,
                }}
              >
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                      fontSize: 14,
                      color: glass.text.fg,
                    }}
                  >
                    {build.name}
                  </Text>
                  {build.character ? (
                    <Text
                      style={{
                        marginTop: 3,
                        fontFamily: APP_FONT_FAMILIES.sansRegular,
                        fontSize: 12,
                        color: glass.text.fg55,
                      }}
                    >
                      {build.character}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.16, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg70,
                  }}
                >
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

/** Header category chip: underline when active, 55% semibold otherwise (ref 6d). */
function CategoryChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      style={{
        paddingBottom: 2,
        borderBottomWidth: 1.5,
        borderBottomColor: active ? glass.text.fg : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: active ? APP_FONT_FAMILIES.sansBold : APP_FONT_FAMILIES.sansSemiBold,
          fontSize: 9,
          letterSpacing: ls(0.16, 9),
          textTransform: "uppercase",
          color: active ? glass.text.fg : glass.text.fg55,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RefineSectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: APP_FONT_FAMILIES.sansBold,
        fontSize: 10,
        letterSpacing: ls(0.16, 10),
        textTransform: "uppercase",
        color: glass.text.fg55,
      }}
    >
      {children}
    </Text>
  );
}

function GlassControlPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: 44,
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: glass.border.default,
        backgroundColor: glass.surface.field,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 12,
          color: glass.text.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GlassFilterChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minHeight: 44,
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? glass.surface.solid : glass.border.default,
        backgroundColor: active ? glass.surface.solid : glass.surface.field,
        paddingHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 12,
          color: active ? glass.text.ink : glass.text.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
