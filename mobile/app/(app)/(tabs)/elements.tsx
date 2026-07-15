import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  formatCents,
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

/** Status label → on-glass chip tone, mirroring web `STATUS_CHIP_TONES`
 * (owned=done, wip=active, to-buy=warn). */
const STATUS_CHIP_TONES: Record<string, GlassStatusTone> = {
  Complete: "success",
  Built: "success",
  Bought: "success",
  "In use": "active",
  "In progress": "active",
  Incomplete: "warning",
};

function nodeStatusTone(row: ElementListRow): GlassStatusTone {
  return STATUS_CHIP_TONES[formatNodeStatus(row)] ?? "neutral";
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

  // Featured backdrop: the last-touched piece, preferring one with imagery (web elements hero).
  // Rows don't carry a typed `updatedAt`; prefer it when present at runtime, else `_creationTime`.
  const featured = useMemo(() => {
    const list = (rows ?? []) as ElementListRow[];
    const byTouch = [...list].sort(
      (a, b) =>
        ((b as { updatedAt?: number }).updatedAt ?? b._creationTime ?? 0) -
        ((a as { updatedAt?: number }).updatedAt ?? a._creationTime ?? 0)
    );
    return byTouch.find((row) => row.imageStorageId || row.imageUrl) ?? byTouch[0];
  }, [rows]);

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
      <PhotoBackdrop
        imageStorageId={(featured?.imageStorageId as Id<"_storage"> | null) ?? undefined}
        imageUrl={featured?.imageUrl ?? undefined}
      />
      <DataBoundary<ListReady> status={status} data={data} error={error}>
        {(loaded) => (
          <ElementsListBody
            loaded={loaded}
            featured={featured}
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
  featured,
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
  featured: ElementListRow | undefined;
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
  const [searchOpen, setSearchOpen] = useState(search.trim().length > 0);
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

  // Only non-default refinements — shown as a caption while the panel is closed.
  const refineParts = [
    viewMode !== "all" ? viewModeLabel : null,
    bucketSummary,
    categorySummary,
    substateSummary,
    hierarchySummary,
    sortBy !== "name" ? sortLabel : null,
    order !== "asc" ? orderLabel : null,
  ].filter((part): part is string => Boolean(part));
  const refineSummary = refineParts.join(" · ");
  const refinesActive = refineParts.length > 0;

  const featuredStatus = featured ? formatNodeStatus(featured) : null;

  const investedCents = useMemo(
    () =>
      filteredRows.reduce((sum, row) => sum + (row.totalCostCents ?? row.directCostCents ?? 0), 0),
    [filteredRows]
  );

  const openNewElement = useCallback(() => {
    router.push(APP_HREF.elementNew);
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={glass.text.fg} />
        }
      >
        {/* Hero — last-touched element identity on the photo (web elements hero). */}
        <View style={{ paddingHorizontal: 22, paddingTop: insets.top + 58 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 9,
              letterSpacing: ls(0.26, 9),
              textTransform: "uppercase",
              color: glass.text.fg,
              opacity: 0.75,
              marginBottom: 10,
            }}
          >
            {t("elements.heroEyebrow", { defaultValue: "Elements · Last touched" })}
          </Text>
          {featured ? (
            <>
              <Pressable
                onPress={() => router.push(APP_HREF.element(featured._id as string))}
                accessibilityRole="button"
                accessibilityLabel={featured.name}
                className="active:opacity-80"
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.displayItalic,
                    fontSize: 38,
                    lineHeight: 42,
                    letterSpacing: ls(-0.02, 38),
                    color: glass.text.fg,
                  }}
                  numberOfLines={3}
                >
                  {featured.name}
                </Text>
              </Pressable>

              {/* Meta triplet: KIND / PROGRESS / DIRECT COST (web hero dl). */}
              <View
                style={{
                  marginTop: 18,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  columnGap: 28,
                  rowGap: 14,
                }}
              >
                <HeroMeta
                  label={t("elements.heroKind", { defaultValue: "Kind" })}
                  value={featured.category?.trim() || formatNodeTypeLabel(featured.nodeType)}
                />
                <HeroMeta
                  label={t("elements.heroProgress", { defaultValue: "Progress" })}
                  value={`${featured.progressPercent ?? 0}%`}
                />
                <HeroMeta
                  label={t("elements.heroDirectCost", { defaultValue: "Direct cost" })}
                  value={formatCents(featured.directCostCents ?? 0)}
                />
              </View>

              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {featuredStatus ? (
                  <GlassStatusChip tone={nodeStatusTone(featured)} label={featuredStatus} />
                ) : null}
                <Text
                  style={{
                    flexShrink: 1,
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 13,
                    color: glass.text.fg70,
                  }}
                  numberOfLines={1}
                >
                  {featured.notes?.split("\n")[0] ??
                    ((featured.childCount ?? 0) === 1
                      ? t("elements.heroPartsLinkedOne", {
                          defaultValue: "{{count}} part linked",
                          count: featured.childCount ?? 0,
                        })
                      : t("elements.heroPartsLinked", {
                          defaultValue: "{{count}} parts linked",
                          count: featured.childCount ?? 0,
                        }))}
                </Text>
              </View>
            </>
          ) : (
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                fontSize: 38,
                lineHeight: 42,
                letterSpacing: ls(-0.02, 38),
                color: glass.text.fg,
              }}
            >
              {t("elements.pageTitle")}
            </Text>
          )}
        </View>

        {/* Work panel — web's closet panel: tabs header, list rows, footer. */}
        <GlassPanel style={{ marginTop: 24, marginHorizontal: 16, overflow: "hidden" }}>
          {/* Type tabs + search/refine toggles — mirrors the web closet panel's header row. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingLeft: 16,
              paddingRight: 8,
              borderBottomWidth: 1,
              borderBottomColor: glass.border.divider,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 1, flexShrink: 1 }}
              contentContainerStyle={{ gap: 18, paddingRight: 12, alignItems: "center" }}
            >
              <UnderlineTab
                active={typeFilter === "all"}
                label={t("elements.tabAllCount", {
                  defaultValue: "All · {{count}}",
                  count: filteredRows.length,
                })}
                onPress={() => setTypeFilter("all")}
              />
              <UnderlineTab
                active={typeFilter === "element"}
                label={t("elements.tabElements", { defaultValue: "Elements" })}
                onPress={() => setTypeFilter("element")}
              />
              <UnderlineTab
                active={typeFilter === "material"}
                label={t("elements.tabMaterials", { defaultValue: "Materials" })}
                onPress={() => setTypeFilter("material")}
              />
            </ScrollView>
            <HeaderIconToggle
              icon="search"
              active={searchOpen || search.trim().length > 0}
              label={t("elements.searchToggle", { defaultValue: "Search elements" })}
              onPress={() => setSearchOpen((value) => !value)}
            />
            <HeaderIconToggle
              icon="options-outline"
              active={filtersOpen || refinesActive}
              label={t("elements.refineElements")}
              onPress={() => setFiltersOpen((value) => !value)}
            />
          </View>

          {searchOpen ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: glass.border.divider,
              }}
            >
              <GlassTextField
                value={search}
                onChangeText={setSearch}
                placeholder={t("elements.searchPlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                autoFocus
              />
            </View>
          ) : null}

          {!filtersOpen && refinesActive ? (
            <Text
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                fontSize: 9,
                letterSpacing: ls(0.14, 9),
                textTransform: "uppercase",
                color: glass.text.fg55,
              }}
              numberOfLines={1}
            >
              {refineSummary}
            </Text>
          ) : null}

          {filtersOpen ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: glass.border.divider,
              }}
            >
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}
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
                <GlassControlPill label={sortLabel} onPress={cycleSort} />
                <GlassControlPill label={orderLabel} onPress={toggleOrder} />
              </View>

              <View style={{ marginTop: 12 }}>
                <RefineSectionLabel>{t("elements.categoryLabel")}</RefineSectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 6 }}
                  contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                >
                  <GlassFilterChip
                    active={categoryFilter === "all"}
                    label={t("elements.filterAll")}
                    onPress={() => setCategoryFilter("all")}
                  />
                  {COSPLAY_CATEGORIES.map((category) => (
                    <GlassFilterChip
                      key={category}
                      active={categoryFilter === category}
                      label={category}
                      onPress={() => setCategoryFilter(category)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ marginTop: 12 }}>
                <RefineSectionLabel>{t("elements.sortBucket")}</RefineSectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 6 }}
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

              <View style={{ marginTop: 12 }}>
                <RefineSectionLabel>{t("elements.substateLabel")}</RefineSectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 6 }}
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

              <View style={{ marginTop: 12 }}>
                <RefineSectionLabel>{t("elements.hierarchyLabel")}</RefineSectionLabel>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 6 }}
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
            </View>
          ) : null}

          {/* Closet rows — 48×60 thumb, kind eyebrow over serif name, cost, toned chip. */}
          {filteredRows.length === 0 ? (
            <View style={{ paddingVertical: 8 }}>
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
              />
            </View>
          ) : (
            filteredRows.map((row, index) => (
              <ElementRow
                key={row._id}
                row={row}
                last={index === filteredRows.length - 1}
                onPress={() => router.push(APP_HREF.element(row._id as string))}
              />
            ))
          )}

          {/* Panel footer — count/invested meta plus the new-element pill (web footer). */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              borderTopWidth: 1,
              borderTopColor: glass.border.divider,
              paddingLeft: 16,
              paddingRight: 10,
              paddingVertical: 8,
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
              numberOfLines={1}
            >
              {(filteredRows.length === 1
                ? t("elements.piecesOne", {
                    defaultValue: "{{count}} piece",
                    count: filteredRows.length,
                  })
                : t("elements.pieces", {
                    defaultValue: "{{count}} pieces",
                    count: filteredRows.length,
                  })) +
                " · " +
                t("elements.invested", {
                  defaultValue: "{{amount}} invested",
                  amount: formatCents(investedCents),
                })}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {filteredRows.length > 0 ? (
                <Pressable
                  onPress={() => setBulkOpen(true)}
                  accessibilityRole="button"
                  className="active:opacity-80"
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    paddingHorizontal: 10,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 9,
                      letterSpacing: ls(0.16, 9),
                      textTransform: "uppercase",
                      color: glass.text.fg55,
                    }}
                  >
                    {t("elements.bulkSelectAction")}
                  </Text>
                </Pressable>
              ) : null}
              <PhotoPill
                variant="outline"
                size="sm"
                icon="add"
                label={t("elements.newElementShort")}
                onPress={openNewElement}
              />
            </View>
          </View>
        </GlassPanel>
      </ScrollView>

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
                  lineHeight: 26,
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

/** Hero meta cell — 10px uppercase label over a 15px sentence-case value (web hero dl). */
function HeroMeta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 10,
          letterSpacing: ls(0.2, 10),
          textTransform: "uppercase",
          color: glass.text.fg55,
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansRegular,
          fontSize: 15,
          fontVariant: ["tabular-nums"],
          color: glass.text.fg,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** Closet list row — the web row anatomy: 48×60 thumb, kind eyebrow over a serif
 * italic name, trailing cost and toned status chip. Flat (no blur) inside the panel. */
function ElementRow({
  row,
  last,
  onPress,
}: {
  row: ElementListRow;
  last: boolean;
  onPress: () => void;
}) {
  const status = formatNodeStatus(row);
  const kind = row.category?.trim() || formatNodeTypeLabel(row.nodeType);
  const cost = row.totalCostCents ?? row.directCostCents ?? 0;
  const placeholderIcon =
    row.nodeType === "material" ? ("flask-outline" as const) : ("shirt-outline" as const);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.name}
      className="active:opacity-80"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: glass.border.divider,
      }}
    >
      <View
        style={{
          width: 48,
          height: 60,
          borderRadius: 8,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: glass.border.default,
          backgroundColor: glass.surface.field,
        }}
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
            <Ionicons name={placeholderIcon} size={18} color={glass.text.fg45} />
          </View>
        )}
      </View>
      <View style={{ minWidth: 0, flex: 1 }}>
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 9,
            letterSpacing: ls(0.16, 9),
            textTransform: "uppercase",
            color: glass.text.fg55,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {kind}
        </Text>
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 16,
            lineHeight: 20,
            color: glass.text.fg,
          }}
          numberOfLines={1}
        >
          {row.name}
        </Text>
      </View>
      {cost > 0 ? (
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansMedium,
            fontSize: 13,
            fontVariant: ["tabular-nums"],
            color: glass.text.fg70,
          }}
        >
          {formatCents(cost)}
        </Text>
      ) : null}
      {status ? <GlassStatusChip tone={nodeStatusTone(row)} label={status} /> : null}
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
              lineHeight: 26,
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

/** Header type tab: underline when active, 55% semibold otherwise (web ElementsUnderlineTab). */
function UnderlineTab({
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
      hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
      className="active:opacity-80"
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
          letterSpacing: ls(0.18, 9),
          textTransform: "uppercase",
          color: active ? glass.text.fg : glass.text.fg55,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Header icon toggle (search / tune) — web's closet-panel header icons at 44pt. */
function HeaderIconToggle({
  icon,
  active,
  label,
  onPress,
}: {
  icon: "search" | "options-outline";
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      className="active:opacity-80"
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={18} color={active ? glass.text.fg : glass.text.fg55} />
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
