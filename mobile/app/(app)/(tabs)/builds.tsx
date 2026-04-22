import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { DataBoundary } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import {
  buildListArgs,
  getTabFilterOptions,
  type SortBy,
  type SortOrder,
  type TabFilter,
} from "@/lib/buildsListArgs";

/** Rows from `api.builds.list` (progress field stripped server-side). */
type BuildListRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
};

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

type ListReady = { rows: BuildListRow[]; userId: string };

type LayoutMode = "comfortable" | "compact" | "grid";

export default function BuildsScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [refreshing, setRefreshing] = useState(false);

  const identity = useQuery(api.auth.getCurrentUser);
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
    [userId, activeTab, search, sortBy, order]
  );

  const rows = useQuery(api.builds.list, listArgs);

  const loading = identity === undefined || (userId != null && rows === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else status = "ready";

  const data: ListReady | undefined =
    status === "ready" && userId ? { rows: rows ?? [], userId } : undefined;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const cycleSort = useCallback(() => {
    const orderList: SortBy[] = ["name", "targetDate", "progress", "budget"];
    const i = orderList.indexOf(sortBy);
    setSortBy(orderList[(i + 1) % orderList.length]!);
  }, [sortBy]);

  const toggleOrder = useCallback(() => {
    setOrder((o) => (o === "asc" ? "desc" : "asc"));
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
  const router = useRouter();
  const { rows, userId } = loaded;
  const [layout, setLayout] = useState<LayoutMode>("comfortable");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const setFocusedBuild = useMutation(api.users.setFocusedBuild);
  const updateBuild = useMutation(api.builds.update);
  const duplicateBuild = useMutation(api.builds.duplicate);

  const cycleLayout = useCallback(() => {
    setLayout((m) => (m === "comfortable" ? "compact" : m === "compact" ? "grid" : "comfortable"));
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((r) => !hiddenIds.has(r._id as string)),
    [rows, hiddenIds]
  );

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
            setHiddenIds((s) => new Set(s).add(item._id as string));
            void (async () => {
              try {
                await updateBuild({
                  id: item._id,
                  userId,
                  status: "archived",
                });
              } catch {
                setHiddenIds((s) => {
                  const n = new Set(s);
                  n.delete(item._id as string);
                  return n;
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
                Alert.alert(
                  t("common.errorTitle"),
                  String(e instanceof Error ? e.message : e)
                );
              }
            })();
          },
        },
      ]);
    },
    [duplicateBuild, router, setFocusedBuild, t, updateBuild, userId]
  );

  const tabOptions = getTabFilterOptions();

  const layoutLabel =
    layout === "comfortable"
      ? t("builds.layoutComfortable")
      : layout === "compact"
        ? t("builds.layoutCompact")
        : t("builds.layoutGrid");

  const compactCards = layout !== "comfortable";

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text className="text-2xl font-semibold text-neutral-900">{t("common.builds")}</Text>
        <Link href={APP_HREF.buildNew} asChild>
          <Pressable className="rounded-full bg-neutral-900 px-3 py-1.5 active:opacity-90">
            <Text className="text-xs font-semibold text-white">{t("builds.createNew")}</Text>
          </Pressable>
        </Link>
      </View>

      <View className="mt-3 px-4">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("builds.searchPlaceholder")}
          placeholderTextColor="#a3a3a3"
          className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base text-neutral-900"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3 max-h-11 px-2"
        contentContainerClassName="gap-2 px-2"
      >
        {tabOptions.map((opt) => {
          const active = activeTab === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setActiveTab(opt.value)}
              className={`rounded-full border px-3 py-1.5 ${
                active ? "border-neutral-900 bg-neutral-900" : "border-neutral-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${active ? "text-white" : "text-neutral-800"}`}
              >
                {t(TAB_I18N[opt.value])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="mt-2 flex-row flex-wrap items-center gap-2 px-4">
        <Pressable
          onPress={cycleSort}
          className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 active:opacity-80"
        >
          <Text className="text-xs font-medium text-neutral-800">{t(SORT_I18N[sortBy])}</Text>
        </Pressable>
        <Pressable
          onPress={toggleOrder}
          className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 active:opacity-80"
        >
          <Text className="text-xs font-medium text-neutral-800">
            {order === "asc" ? t("builds.sortAsc") : t("builds.sortDesc")}
          </Text>
        </Pressable>
        <Pressable
          onPress={cycleLayout}
          className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 active:opacity-80"
        >
          <Text className="text-xs font-medium text-neutral-800">{layoutLabel}</Text>
        </Pressable>
      </View>

      <FlatList
        key={layout}
        data={visibleRows}
        numColumns={layout === "grid" ? 2 : 1}
        keyExtractor={(item) => item._id}
        columnWrapperStyle={layout === "grid" ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text className="py-12 text-center text-neutral-500">
            {search.trim() ? t("builds.emptySearch") : t("builds.empty")}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            className={`${layout === "grid" ? "mb-3 flex-1" : "mb-3"} overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 active:opacity-90`}
            onPress={() => router.push(APP_HREF.build(item._id))}
            onLongPress={() => showActions(item)}
          >
            <BuildCardRow item={item} t={t} compact={compactCards} />
          </Pressable>
        )}
      />
    </View>
  );
}

function BuildCardRow({
  item,
  t,
  compact,
}: {
  item: BuildListRow;
  t: (key: string, opt?: Record<string, string | number>) => string;
  compact?: boolean;
}) {
  const pct = item.tasksTotal > 0 ? Math.round((100 * item.tasksChecked) / item.tasksTotal) : 0;
  return (
    <View className={compact ? "px-3 py-2" : "px-4 py-3"}>
      <Text
        className={`font-semibold text-neutral-900 ${compact ? "text-base" : "text-lg"}`}
        numberOfLines={compact ? 2 : undefined}
      >
        {item.name}
      </Text>
      {item.character ? (
        <Text className="mt-0.5 text-sm text-neutral-600">{item.character}</Text>
      ) : null}
      <Text className="mt-2 text-xs text-neutral-500">
        {t("builds.tasksProgress", { checked: item.tasksChecked, total: item.tasksTotal })} ·{" "}
        {t("builds.progressPercent", { pct })}
      </Text>
      {item.tasksTotal > 0 ? (
        <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <View className="h-full rounded-full bg-neutral-900" style={{ width: `${pct}%` }} />
        </View>
      ) : null}
    </View>
  );
}
