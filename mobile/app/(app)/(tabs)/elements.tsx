import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
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
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
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
} from "@kyarafit/design-system/domain";
import { ElementPortfolioCard } from "@/components/elements/ElementPortfolioCard";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { DataBoundary, FloatingCreateMenu, MetaLabel } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";

type SortKey = "name" | "progress" | "bucket";
type ViewMode = "all" | "tree";
type TypeFilter = "all" | CosplayNodeType;
type BucketFilter = "all" | (typeof COSPLAY_OVERALL_BUCKETS)[number];
type CategoryFilter = "all" | (typeof COSPLAY_CATEGORIES)[number];

type ElementListRow = CosplayExplorerItem & { _id: Id<"cosplayNodes"> };
type ElementLayoutMode = "comfortable" | "compact" | "grid";

type ListReady = {
  rows: ElementListRow[];
  userId: string;
};

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
  const [refreshing, setRefreshing] = useState(false);

  const identity = useQuery(api.auth.getCurrentUser);
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

  const rows = useQuery(api.cosplayNodes.list, listArgs);

  const loading = identity === undefined || (userId != null && rows === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else status = "ready";

  const data: ListReady | undefined =
    status === "ready" && userId ? { rows: (rows ?? []) as ElementListRow[], userId } : undefined;

  const cycleSort = useCallback(() => {
    const orderList: SortKey[] = ["name", "progress", "bucket"];
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
  refreshing: boolean;
  onRefresh: () => void;
  router: ReturnType<typeof useRouter>;
  t: TFunction;
  placeholderColor: string;
}) {
  const { colors } = useDesignTheme();
  const { rows } = loaded;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<ElementLayoutMode>("comfortable");

  const cycleLayout = useCallback(() => {
    setLayout((mode) =>
      mode === "comfortable" ? "compact" : mode === "compact" ? "grid" : "comfortable"
    );
  }, []);

  const sortLabel =
    sortBy === "name"
      ? t("elements.sortName")
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

  const filterSummary = [
    viewModeLabel,
    typeSummary,
    bucketSummary,
    categorySummary,
    sortLabel,
    orderLabel,
    layoutLabel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <View className="px-5 pb-3 pt-7">
        <Text
          style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
          className="text-[23px] leading-[1.08] tracking-tight text-kyar-text dark:text-kyar-dark-text"
        >
          {t("elements.pageTitle")}
        </Text>

        <View className="mt-5 w-full flex-row items-center gap-2 border-b border-kyar-border pb-2 dark:border-kyar-dark-border">
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
        data={rows}
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
          <Text className="pb-3 text-[10px] uppercase tracking-widest text-kyar-meta opacity-60 dark:text-kyar-dark-meta">
            {rows.length === 1
              ? t("elements.countSingular", { count: rows.length })
              : t("elements.countPlural", { count: rows.length })}
          </Text>
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

      <FloatingCreateMenu
        actions={[
          {
            key: "new-element",
            label: t("elements.newShort"),
            icon: "layers-outline",
            onPress: () => router.push(APP_HREF.elementNew),
          },
          {
            key: "new-build",
            label: t("builds.createNew"),
            icon: "shirt-outline",
            onPress: () => router.push(APP_HREF.buildNew),
          },
        ]}
      />
    </View>
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
