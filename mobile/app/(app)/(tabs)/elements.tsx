import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useNavigation, useRouter } from "expo-router";
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
import { DataBoundary } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";

type SortKey = "name" | "progress" | "bucket";

type ViewMode = "all" | "tree";

type TypeFilter = "all" | CosplayNodeType;
type BucketFilter = "all" | (typeof COSPLAY_OVERALL_BUCKETS)[number];
type CategoryFilter = "all" | (typeof COSPLAY_CATEGORIES)[number];

type ElementListRow = CosplayExplorerItem & { _id: Id<"cosplayNodes"> };

type ListReady = {
  rows: ElementListRow[];
  userId: string;
};

export default function ElementsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
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
  }, [userId, sortBy, order, search, viewMode, typeFilter, bucketFilter, categoryFilter]);

  const rows = useQuery(api.cosplayNodes.list, listArgs);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Link href={APP_HREF.elementNew} asChild>
          <Pressable
            accessibilityRole="button"
            className="mr-2 rounded-lg bg-kyar-text px-3 py-2 active:opacity-80"
          >
            <Text className="text-sm font-semibold text-kyar-bg">{t("elements.newShort")}</Text>
          </Pressable>
        </Link>
      ),
    });
  }, [navigation, t]);

  const loading = identity === undefined || (userId != null && rows === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else status = "ready";

  const data: ListReady | undefined =
    status === "ready" && userId
      ? { rows: (rows ?? []) as ElementListRow[], userId }
      : undefined;

  const cycleSort = useCallback(() => {
    const orderList: SortKey[] = ["name", "progress", "bucket"];
    const i = orderList.indexOf(sortBy);
    setSortBy(orderList[(i + 1) % orderList.length]!);
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
          toggleOrder={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
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
}) {
  const { rows } = loaded;

  const sortLabel =
    sortBy === "name"
      ? t("elements.sortName")
      : sortBy === "progress"
        ? t("elements.sortProgress")
        : t("elements.sortBucket");

  return (
    <View className="flex-1 bg-kyar-bg">
      <View className="border-b border-kyar-borderSubtle bg-kyar-bg px-4 pb-3 pt-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("elements.searchPlaceholder")}
          placeholderTextColor="rgba(23,22,41,0.52)"
          className="rounded-xl border border-kyar-borderSubtle bg-kyar-surface px-3 py-3 text-base text-kyar-text"
        />
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <Pressable
            onPress={() => setViewMode("all")}
            className={`rounded-full px-4 py-2 ${viewMode === "all" ? "bg-kyar-text" : "bg-kyar-muted"}`}
          >
            <Text className={`text-xs font-semibold uppercase ${viewMode === "all" ? "text-kyar-bg" : "text-kyar-text"}`}>
              {t("elements.tabAll")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("tree")}
            className={`rounded-full px-4 py-2 ${viewMode === "tree" ? "bg-kyar-text" : "bg-kyar-muted"}`}
          >
            <Text
              className={`text-xs font-semibold uppercase ${viewMode === "tree" ? "text-kyar-bg" : "text-kyar-text"}`}
            >
              {t("elements.tabTree")}
            </Text>
          </Pressable>
          <View className="flex-1" />
          <Pressable onPress={cycleSort} className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2">
            <Text className="text-xs font-medium text-kyar-text">{sortLabel}</Text>
          </Pressable>
          <Pressable onPress={toggleOrder} className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2">
            <Text className="text-xs font-medium text-kyar-text">
              {order === "asc" ? t("builds.sortAsc") : t("builds.sortDesc")}
            </Text>
          </Pressable>
        </View>

        <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-kyar-meta">
          {t("elements.filtersHeading")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row flex-wrap gap-2 pb-1">
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row flex-wrap gap-2 pb-1">
            <FilterChip
              active={bucketFilter === "all"}
              label={t("elements.filterAll")}
              onPress={() => setBucketFilter("all")}
            />
            {COSPLAY_OVERALL_BUCKETS.map((b) => (
              <FilterChip
                key={b}
                active={bucketFilter === b}
                label={formatOverallBucket(b)}
                onPress={() => setBucketFilter(b)}
              />
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          <View className="flex-row flex-wrap gap-2 pb-1">
            <FilterChip
              active={categoryFilter === "all"}
              label={t("elements.filterAll")}
              onPress={() => setCategoryFilter("all")}
            />
            {COSPLAY_CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={categoryFilter === c}
                label={c}
                onPress={() => setCategoryFilter(c)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <FlatList
        className="flex-1 bg-kyar-bg"
        data={rows}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text className="mt-12 px-6 text-center text-kyar-meta">
            {search.trim() ? t("elements.emptySearch") : t("elements.empty")}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            className="border-b border-kyar-borderSubtle px-4 py-4 active:bg-kyar-mutedWarm"
            onPress={() => router.push(APP_HREF.element(item._id as string))}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-base font-semibold text-kyar-text">{item.name}</Text>
                <Text className="mt-1 text-xs text-kyar-meta">
                  {formatNodeTypeLabel(item.nodeType)}
                  {item.category ? ` · ${item.category}` : ""}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-medium text-kyar-textSecondary">
                  {item.progressPercent ?? 0}%
                </Text>
                <Text className="mt-0.5 text-[10px] uppercase text-kyar-textTertiary">
                  {formatOverallBucket(item.overallBucket)}
                </Text>
              </View>
            </View>
            <Text className="mt-2 text-sm text-kyar-textSecondary">{formatNodeStatus(item)}</Text>
            {item.childCount != null && item.childCount > 0 ? (
              <Text className="mt-1 text-xs text-kyar-textTertiary">
                {t("elements.childCount", { count: item.childCount })}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
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
      className={`rounded-full px-3 py-1.5 ${active ? "bg-kyar-text" : "bg-kyar-muted"}`}
    >
      <Text className={`text-xs font-medium ${active ? "text-kyar-bg" : "text-kyar-text"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
