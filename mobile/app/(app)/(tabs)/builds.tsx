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
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { BuildPortfolioCard } from "@/components/builds/BuildPortfolioCard";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { DataBoundary, FloatingCreateMenu, MetaLabel } from "@/ui";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { APP_HREF } from "@/lib/appRoutes";
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
};

/** Long labels for status chips + refine-bar summary (parity with web). */
const TAB_SUMMARY_I18N: Record<TabFilter, string> = {
  all: "builds.tabSummaryAll",
  current: "builds.tabSummaryCurrent",
  planning: "builds.tabSummaryPlanning",
  completed: "builds.tabSummaryCompleted",
  archived: "builds.tabSummaryArchived",
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
    [activeTab, order, search, sortBy, userId]
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
  const { colors } = useDesignTheme();
  const { rows, userId } = loaded;
  const [layout, setLayout] = useState<LayoutMode>("comfortable");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFocusedBuild = useMutation(api.users.setFocusedBuild);
  const updateBuild = useMutation(api.builds.update);
  const duplicateBuild = useMutation(api.builds.duplicate);

  const cycleLayout = useCallback(() => {
    setLayout((mode) =>
      mode === "comfortable" ? "compact" : mode === "compact" ? "grid" : "comfortable"
    );
  }, []);

  const visibleRows = useMemo(
    () => rows.filter((row) => !hiddenIds.has(row._id as string)),
    [hiddenIds, rows]
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

  const tabOptions = getTabFilterOptions();

  const layoutLabel =
    layout === "comfortable"
      ? t("builds.layoutComfortable")
      : layout === "compact"
        ? t("builds.layoutCompact")
        : t("builds.layoutGrid");
  const sortLabel = t(SORT_I18N[sortBy]);
  const orderLabel = order === "asc" ? t("builds.sortAsc") : t("builds.sortDesc");
  const summaryTabLabel = t(TAB_SUMMARY_I18N[activeTab]);
  const filterSummary = [summaryTabLabel, sortLabel, orderLabel, layoutLabel].join(" · ");

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <View className="px-5 pb-3 pt-7">
        <Text
          style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
          className="text-[23px] leading-[1.08] tracking-tight text-kyar-text dark:text-kyar-dark-text"
        >
          {t("builds.pageTitle")}
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
            placeholder={t("builds.searchPlaceholder")}
            placeholderTextColor={colors.textTertiary}
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
              {t("builds.refineBuilds")}
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
            <MetaLabel>{t("builds.filtersStatusLabel")}</MetaLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-2"
              contentContainerClassName="gap-2 pr-1"
            >
              {tabOptions.map((option) => {
                const active = activeTab === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setActiveTab(option.value)}
                    className={`min-h-[44px] shrink justify-center rounded-full border px-4 py-2 ${
                      active
                        ? "border-kyar-text bg-kyar-text shadow-md dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                        : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                    }`}
                  >
                    <Text
                      style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
                      className={`text-[10px] uppercase tracking-wider ${
                        active
                          ? "text-kyar-bg dark:text-kyar-dark-bg"
                          : "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                      }`}
                    >
                      {t(TAB_SUMMARY_I18N[option.value])}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mt-5">
              <MetaLabel>{t("builds.filtersSortViewLabel")}</MetaLabel>
              <View className="mt-2 flex-row flex-wrap gap-2">
                <ControlPill label={sortLabel} onPress={cycleSort} />
                <ControlPill label={orderLabel} onPress={toggleOrder} />
                <ControlPill label={layoutLabel} onPress={cycleLayout} />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      <FlatList
        key={layout}
        data={visibleRows}
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
            {visibleRows.length} {visibleRows.length === 1 ? "build" : "builds"}
          </Text>
        }
        ListEmptyComponent={
          <Text className="py-12 text-center text-kyar-meta dark:text-kyar-dark-meta">
            {search.trim() ? t("builds.emptySearch") : t("builds.empty")}
          </Text>
        }
        renderItem={({ item, index }) => (
          <Pressable
            className={layout === "grid" ? "mb-3 flex-1" : "mb-3"}
            onPress={() => router.push(APP_HREF.build(item._id))}
            onLongPress={() => showActions(item)}
          >
            <BuildPortfolioCard
              variant={layout}
              projectIndex={index + 1}
              item={{
                name: item.name,
                character: item.character,
                status: item.status,
                imageStorageId: item.imageStorageId,
                imageUrl: item.imageUrl,
                tasksTotal: item.tasksTotal,
                tasksChecked: item.tasksChecked,
              }}
            />
          </Pressable>
        )}
      />

      <FloatingCreateMenu
        actions={[
          {
            key: "new-build",
            label: t("builds.createNew"),
            icon: "shirt-outline",
            onPress: () => router.push(APP_HREF.buildNew),
          },
          {
            key: "new-element",
            label: t("common.elements"),
            icon: "layers-outline",
            onPress: () => router.push(APP_HREF.elementNew),
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
