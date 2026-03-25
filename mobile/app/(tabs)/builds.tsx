import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { listBuilds } from "../../src/storage/buildsRepo";
import { useDataSource } from "../../src/hooks/useDataSource";
import {
  FilterTabs,
  KyarIcon,
  MetaLabel,
  ScreenHeader,
  EmptyState,
} from "../../src/components/shared";
import { colors } from "@kyarafit/design-system/rn";
import { useTranslation } from "react-i18next";

type TabFilter = "all" | "current" | "archived" | "planning" | "completed";

type SortPreset = "nameAsc" | "nameDesc" | "targetDesc" | "progressDesc";

type BuildRow = {
  id: string;
  name: string;
  status: BuildStatus;
  character?: string;
  imageUrl?: string;
  tasksChecked: number;
  tasksTotal: number;
};

function statusForConvexTab(tab: TabFilter): BuildStatus | undefined {
  switch (tab) {
    case "all":
      return undefined;
    case "current":
      return "wip";
    case "planning":
      return "idea";
    case "completed":
      return "ready";
    case "archived":
      return "archived";
  }
}

function sortArgs(preset: SortPreset): {
  sortBy: "name" | "targetDate" | "progress";
  order: "asc" | "desc";
} {
  switch (preset) {
    case "nameAsc":
      return { sortBy: "name", order: "asc" };
    case "nameDesc":
      return { sortBy: "name", order: "desc" };
    case "targetDesc":
      return { sortBy: "targetDate", order: "desc" };
    case "progressDesc":
      return { sortBy: "progress", order: "desc" };
  }
}

export default function BuildsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId, isCloud, userQueryArgs } = useDataSource();

  const filterTabs: { id: TabFilter; label: string }[] = useMemo(
    () => [
      { id: "all", label: t("Builds.filterAll") },
      { id: "current", label: t("Builds.filterCurrent") },
      { id: "planning", label: t("Builds.filterPlanning") },
      { id: "completed", label: t("Builds.filterCompleted") },
      { id: "archived", label: t("Builds.filterArchived") },
    ],
    [t]
  );

  const sortTabs: { id: SortPreset; label: string }[] = useMemo(
    () => [
      { id: "nameAsc", label: t("Builds.sortNameAsc") },
      { id: "nameDesc", label: t("Builds.sortNameDesc") },
      { id: "targetDesc", label: t("Builds.sortDeadline") },
      { id: "progressDesc", label: t("Builds.sortProgress") },
    ],
    [t]
  );

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [sortPreset, setSortPreset] = useState<SortPreset>("nameAsc");

  const { sortBy, order } = sortArgs(sortPreset);

  const convexListArgs = useMemo(() => {
    if (!userId) return "skip" as const;
    const q = search.trim();
    return {
      userId,
      status: statusForConvexTab(activeTab),
      search: q.length ? q : undefined,
      sortBy,
      order,
    };
  }, [userId, activeTab, search, sortBy, order]);

  const convexBuilds = useQuery(api.builds.list, convexListArgs);

  const [localBuilds, setLocalBuilds] = useState<BuildRow[]>([]);
  const [localLoading, setLocalLoading] = useState(!isCloud);

  useFocusEffect(
    useCallback(() => {
      if (!isCloud) {
        setLocalLoading(true);
        listBuilds().then((list) => {
          setLocalBuilds(
            list.map((b) => ({
              id: b.id,
              name: b.name,
              status: b.status as BuildStatus,
              character: b.character,
              imageUrl: b.imageUrl,
              tasksChecked: b.tasksChecked ?? 0,
              tasksTotal: b.tasksTotal ?? 0,
            }))
          );
          setLocalLoading(false);
        });
      }
    }, [isCloud])
  );

  const loading = isCloud ? convexBuilds === undefined : localLoading;

  const rawBuilds: BuildRow[] = isCloud
    ? (convexBuilds ?? []).map((b) => ({
        id: b._id as string,
        name: b.name,
        status: b.status as BuildStatus,
        character: b.character,
        imageUrl: b.imageUrl,
        tasksChecked: b.tasksChecked ?? 0,
        tasksTotal: b.tasksTotal ?? 0,
      }))
    : localBuilds;

  const filteredBuilds = useMemo(() => {
    if (isCloud) return rawBuilds;
    const st = statusForConvexTab(activeTab);
    let rows = st ? rawBuilds.filter((b) => b.status === st) : rawBuilds;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) => b.name.toLowerCase().includes(q) || (b.character ?? "").toLowerCase().includes(q)
      );
    }
    const { sortBy: sb, order: ord } = sortArgs(sortPreset);
    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sb === "name") cmp = a.name.localeCompare(b.name);
      else if (sb === "progress")
        cmp =
          a.tasksTotal > 0
            ? a.tasksChecked / a.tasksTotal - (b.tasksTotal > 0 ? b.tasksChecked / b.tasksTotal : 0)
            : 0;
      else cmp = 0;
      return ord === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [isCloud, rawBuilds, activeTab, search, sortPreset]);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader meta={t("Builds.metaPortfolio")} title={t("Home.myBuilds")} bottomPadding={0} />
      <View className="px-6 pt-2 pb-2">
        <View className="flex-row items-center border-b border-black/10 pb-2 mb-2">
          <KyarIcon name="search" size={20} color={colors.textTertiary} />
          <TextInput
            className="flex-1 ml-2 text-sm text-black py-2"
            placeholder="Search outfits…"
            placeholderTextColor="rgba(0,0,0,0.35)"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <View className="flex-row justify-end items-center">
          <Pressable
            className="flex-row items-center gap-2 border border-black px-3 py-1.5"
            onPress={() => router.push("/closet")}
            accessibilityRole="button"
            accessibilityLabel={t("Builds.openClosetA11y")}
          >
            <KyarIcon name="checkroom" size={16} color={colors.text} />
            <MetaLabel style={{ color: colors.text }}>Closet</MetaLabel>
          </Pressable>
        </View>
      </View>

      <FilterTabs tabs={filterTabs} active={activeTab} onChange={setActiveTab} />

      <View className="border-b border-black/5">
        <FilterTabs tabs={sortTabs} active={sortPreset} onChange={setSortPreset} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140, paddingTop: 16 }}>
        {loading ? (
          <Text className="text-xs text-black/50 px-6 py-6">{t("Builds.loading")}</Text>
        ) : null}
        {!loading && rawBuilds.length === 0 ? (
          <View className="px-6 mb-6">
            <EmptyState
              icon="layers"
              message={t("Builds.emptyList")}
              secondary={t("Builds.emptyListSecondary")}
            />
          </View>
        ) : null}
        {!loading && filteredBuilds.length === 0 && rawBuilds.length > 0 ? (
          <Text className="text-xs text-black/50 px-6 py-6">No builds in this category.</Text>
        ) : null}

        <View className="flex-row flex-wrap justify-between px-6">
          {filteredBuilds.map((b, index) => {
            const projectNumber = String(index + 1).padStart(3, "0");

            return (
              <View key={b.id} className="w-[48%] mb-8">
                <Pressable
                  onPress={() => router.push({ pathname: "/build-detail", params: { id: b.id } })}
                >
                  {b.imageUrl ? (
                    <Image
                      source={{ uri: b.imageUrl }}
                      className="w-full aspect-[2/3] bg-[#F9F9F9] mb-4"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full aspect-[2/3] bg-[#F9F9F9] mb-4 justify-center items-center">
                      <KyarIcon name="image" size={32} color="rgba(0,0,0,0.4)" />
                    </View>
                  )}
                </Pressable>

                <View className="gap-1">
                  <Text className="text-[8px] tracking-[0.2em] uppercase text-black/50 font-semibold mb-1">
                    {t("Builds.projectLabel", { number: projectNumber })}
                  </Text>
                  <Text className="font-serif text-lg italic text-black tracking-tight leading-tight">
                    {b.name}
                  </Text>
                  {b.character ? (
                    <Text className="text-[10px] text-black/60 mt-1">{b.character}</Text>
                  ) : null}
                </View>

                <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-black/5">
                  <Text className="text-[9px] uppercase tracking-widest text-black/40">
                    {b.status}
                  </Text>
                  <Text className="text-[9px] uppercase tracking-widest text-black/40">
                    {b.tasksChecked}/{b.tasksTotal}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
