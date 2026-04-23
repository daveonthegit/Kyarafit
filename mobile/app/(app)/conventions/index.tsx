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
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { ConventionEventPoster } from "@/components/conventions/ConventionEventPoster";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { useOfflineQuery } from "@/offline";
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
import { DataBoundary, FloatingCreateMenu, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

const FILTER_KEYS: ConventionFilter[] = ["all", "upcoming", "past", "archived"];
const SORT_KEYS: ConventionSortBy[] = ["startDate", "name", "location"];

type Ready = {
  conventions: ConventionWithDetails[];
};

export default function ConventionsIndexScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const conventions = useOfflineQuery(api.conventions.listWithDetails, userId ? { userId } : "skip");

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
      <Stack.Screen options={{ headerShown: true, title: t("nav.events"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={data} error={error} empty={<EmptyConventionState />}>
        {(loaded) => <ConventionsBody conventions={loaded.conventions} />}
      </DataBoundary>
    </>
  );
}

function ConventionsBody({ conventions }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useDesignTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ConventionFilter>("upcoming");
  const [sortBy, setSortBy] = useState<ConventionSortBy>("startDate");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(
    () => filterAndSortConventions(conventions, search, filter, sortBy, order),
    [conventions, filter, order, search, sortBy]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  }, []);

  const createActions = useMemo(
    () => buildGlobalAddMenuActions("events", t, router),
    [router, t]
  );

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
          paddingBottom: 132,
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

            <View className="flex-row items-center justify-between">
              <MetaLabel>
                {t("conventions.resultsCount", {
                  count: filtered.length,
                })}
              </MetaLabel>
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
