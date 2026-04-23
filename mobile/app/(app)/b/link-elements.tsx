import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import type { TFunction } from "i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import {
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
  type CosplayExplorerItem,
} from "@kyarafit/design-system/domain";
import { COSPLAY_OVERALL_BUCKETS, type CosplayNodeType } from "@kyarafit/design-system/types";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  Button,
  DataBoundary,
  FloatingCreateMenu,
  MetaLabel,
  SectionHeading,
  SurfaceCard,
} from "@/ui";

type SortKey = "name" | "progress" | "bucket";
type TypeFilter = "all" | CosplayNodeType;
type BucketFilter = "all" | (typeof COSPLAY_OVERALL_BUCKETS)[number];
type LinkedFilter = "all" | "linked" | "unlinked";

type LinkRow = CosplayExplorerItem & { _id: Id<"cosplayNodes"> };

type Ready = {
  buildId: Id<"builds">;
  buildName: string;
  userId: string;
  rows: LinkRow[];
  initialLinked: Id<"cosplayNodes">[];
};

export default function LinkElementsScreen() {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const raw = useLocalSearchParams<{ buildId: string | string[] }>().buildId;
  const buildIdParam = Array.isArray(raw) ? raw[0] : raw;
  const buildId = buildIdParam ? (buildIdParam as Id<"builds">) : undefined;

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("all");

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const build = useQuery(api.builds.get, buildId ? { id: buildId } : "skip");
  const linkedIds = useQuery(api.builds.getNodes, buildId ? { buildId } : "skip");

  const listArgs = useMemo(() => {
    if (!userId || !buildId) return "skip" as const;
    const query = search.trim();
    return {
      userId,
      buildId,
      sortBy,
      order,
      ...(query ? { search: query } : {}),
      ...(typeFilter !== "all" ? { nodeType: typeFilter } : {}),
      ...(bucketFilter !== "all" ? { overallBucket: bucketFilter } : {}),
    };
  }, [bucketFilter, buildId, order, search, sortBy, typeFilter, userId]);

  const catalog = useQuery(api.cosplayNodes.list, listArgs);
  const linkNodes = useMutation(api.builds.linkNodes);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: build?.name
        ? t("linkElements.titleWithBuild", { name: build.name })
        : t("linkElements.title"),
    });
  }, [build?.name, navigation, t]);

  const loading =
    identity === undefined ||
    (buildId != null && (build === undefined || catalog === undefined || linkedIds === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!buildId || !userId || build === null) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && catalog && linkedIds !== undefined && buildId && userId && build
      ? {
          buildId,
          buildName: build.name,
          userId,
          rows: catalog as LinkRow[],
          initialLinked: linkedIds,
        }
      : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => (
        <LinkElementsBody
          loaded={loaded}
          onDone={() => router.back()}
          onCreateElement={() => router.push(APP_HREF.elementNewWithType("element"))}
          onCreateMaterial={() => router.push(APP_HREF.elementNewWithType("material"))}
          linkNodes={linkNodes}
          placeholderColor={colors.textTertiary}
          search={search}
          setSearch={setSearch}
          sortBy={sortBy}
          order={order}
          typeFilter={typeFilter}
          bucketFilter={bucketFilter}
          setTypeFilter={setTypeFilter}
          setBucketFilter={setBucketFilter}
          cycleSort={() =>
            setSortBy((value) =>
              value === "name" ? "progress" : value === "progress" ? "bucket" : "name"
            )
          }
          toggleOrder={() => setOrder((value) => (value === "asc" ? "desc" : "asc"))}
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function LinkElementsBody({
  loaded,
  onDone,
  onCreateElement,
  onCreateMaterial,
  linkNodes,
  placeholderColor,
  search,
  setSearch,
  sortBy,
  order,
  typeFilter,
  bucketFilter,
  setTypeFilter,
  setBucketFilter,
  cycleSort,
  toggleOrder,
  t,
}: {
  loaded: Ready;
  onDone: () => void;
  onCreateElement: () => void;
  onCreateMaterial: () => void;
  linkNodes: (args: {
    userId: string;
    buildId: Id<"builds">;
    cosplayNodeIds: Id<"cosplayNodes">[];
  }) => Promise<unknown>;
  placeholderColor: string;
  search: string;
  setSearch: (value: string) => void;
  sortBy: SortKey;
  order: "asc" | "desc";
  typeFilter: TypeFilter;
  bucketFilter: BucketFilter;
  setTypeFilter: (value: TypeFilter) => void;
  setBucketFilter: (value: BucketFilter) => void;
  cycleSort: () => void;
  toggleOrder: () => void;
  t: TFunction;
}) {
  const { rows } = loaded;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(loaded.initialLinked.map((id) => id as string))
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [linkedFilter, setLinkedFilter] = useState<LinkedFilter>("all");
  const [pending, setPending] = useState(false);

  const toggle = useCallback((id: Id<"cosplayNodes">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = id as string;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const isSelected = selected.has(row._id as string);
      if (linkedFilter === "linked") return isSelected;
      if (linkedFilter === "unlinked") return !isSelected;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aSelected = selected.has(a._id as string);
      const bSelected = selected.has(b._id as string);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [linkedFilter, rows, selected]);

  const selectedCount = selected.size;
  const visibleLinkedCount = sortedRows.filter((row) => selected.has(row._id as string)).length;
  const sortLabel =
    sortBy === "name"
      ? t("elements.sortName")
      : sortBy === "progress"
        ? t("elements.sortProgress")
        : t("elements.sortBucket");
  const orderLabel = order === "asc" ? t("builds.sortAsc") : t("builds.sortDesc");
  const filterSummary = [
    linkedFilter === "all"
      ? t("linkElements.filterAll")
      : linkedFilter === "linked"
        ? t("linkElements.filterLinked")
        : t("linkElements.filterUnlinked"),
    typeFilter === "all"
      ? t("elements.filterAll")
      : typeFilter === "element"
        ? t("elements.typeElement")
        : t("elements.typeMaterial"),
    bucketFilter === "all" ? t("elements.filterAll") : formatOverallBucket(bucketFilter),
    sortLabel,
    orderLabel,
    t("linkElements.selectedCount", { count: selectedCount }),
  ].join(" · ");

  const save = useCallback(async () => {
    setPending(true);
    try {
      await linkNodes({
        userId: loaded.userId,
        buildId: loaded.buildId,
        cosplayNodeIds: Array.from(selected) as Id<"cosplayNodes">[],
      });
      onDone();
    } finally {
      setPending(false);
    }
  }, [linkNodes, loaded.buildId, loaded.userId, onDone, selected]);

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <View className="px-5 pb-3 pt-4">
        <SectionHeading eyebrow={loaded.buildName} title={t("linkElements.title")} />
        <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("linkElements.subtitle")}
        </Text>

        <SurfaceCard className="mt-4 px-4 py-4">
          <TextInput
            value={search}
            placeholder={t("elements.searchPlaceholder")}
            placeholderTextColor={placeholderColor}
            className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
            onChangeText={setSearch}
          />
        </SurfaceCard>
      </View>

      <LinkElementsFilters
        filterSummary={filterSummary}
        filtersOpen={filtersOpen}
        linkedFilter={linkedFilter}
        sortLabel={sortLabel}
        orderLabel={orderLabel}
        typeFilter={typeFilter}
        bucketFilter={bucketFilter}
        onSetLinkedFilter={setLinkedFilter}
        onSetTypeFilter={setTypeFilter}
        onSetBucketFilter={setBucketFilter}
        onCycleSort={cycleSort}
        onToggleOrder={toggleOrder}
        onToggleFilters={() => setFiltersOpen((value) => !value)}
        t={t}
      />

      <FlatList
        className="flex-1"
        data={sortedRows}
        keyExtractor={(item) => item._id as string}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 140,
          gap: 12,
        }}
        ListHeaderComponent={
          <Text className="pb-3 text-[10px] font-bold uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta">
            {t("linkElements.resultsSummary", {
              shown: sortedRows.length,
              selected: visibleLinkedCount,
            })}
          </Text>
        }
        ListEmptyComponent={
          <SurfaceCard className="mt-8 items-center px-5 py-6">
            <Text className="text-center text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {selectedCount > 0 || linkedFilter !== "all"
                ? t("linkElements.emptyFiltered")
                : t("elements.emptySearch")}
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Button
                title={t("elements.newElementShort")}
                variant="secondary"
                onPress={onCreateElement}
              />
              <Button
                title={t("elements.newMaterialShort")}
                variant="secondary"
                onPress={onCreateMaterial}
              />
            </View>
          </SurfaceCard>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item._id as string);
          return (
            <Pressable onPress={() => toggle(item._id)}>
              <SurfaceCard
                className={`px-4 py-4 ${
                  isSelected
                    ? "border-kyar-text bg-kyar-panelRaised dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised"
                    : ""
                }`}
              >
                <View className="flex-row items-start gap-3">
                  <View className="h-[76px] w-[76px] overflow-hidden rounded-2xl bg-kyar-panel dark:bg-kyar-dark-panel">
                    {item.imageStorageId || item.imageUrl ? (
                      <ConvexStorageImage
                        storageId={
                          (item.imageStorageId as Id<"_storage"> | null | undefined) ?? null
                        }
                        imageUrl={item.imageUrl}
                        className="h-full w-full"
                        accessibilityLabel={item.name}
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center">
                        <Ionicons
                          name={item.nodeType === "material" ? "cube-outline" : "layers-outline"}
                          size={28}
                          color="#76737d"
                        />
                      </View>
                    )}
                  </View>

                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <MetaLabel>
                          {formatNodeTypeLabel(item.nodeType)}
                          {item.category ? ` · ${item.category}` : ""}
                        </MetaLabel>
                        <Text
                          style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                          className="mt-2 text-[28px] italic leading-[30px] text-kyar-text dark:text-kyar-dark-text"
                          numberOfLines={2}
                        >
                          {item.name}
                        </Text>
                      </View>

                      <View
                        className={`rounded-full px-3 py-2 ${
                          isSelected
                            ? "bg-kyar-text dark:bg-kyar-dark-text"
                            : "bg-kyar-panel dark:bg-kyar-dark-panel"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-semibold uppercase tracking-widest ${
                            isSelected
                              ? "text-kyar-bg dark:text-kyar-dark-bg"
                              : "text-kyar-meta dark:text-kyar-dark-meta"
                          }`}
                        >
                          {isSelected ? t("linkElements.linkedBadge") : t("linkElements.tapToLink")}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row flex-wrap items-center gap-2">
                      <InfoChip label={formatOverallBucket(item.overallBucket)} />
                      <InfoChip label={formatNodeStatus(item)} />
                      {item.childCount != null && item.childCount > 0 ? (
                        <InfoChip label={t("elements.childCount", { count: item.childCount })} />
                      ) : null}
                    </View>
                  </View>
                </View>
              </SurfaceCard>
            </Pressable>
          );
        }}
      />

      <View className="border-t border-kyar-borderSubtle bg-kyar-bg px-5 pb-5 pt-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-bg">
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <MetaLabel>{t("linkElements.selectedLabel")}</MetaLabel>
            <Text className="mt-1 text-sm text-kyar-text dark:text-kyar-dark-text">
              {t("linkElements.selectedCount", { count: selectedCount })}
            </Text>
          </View>
          <Button title={t("linkElements.save")} loading={pending} onPress={() => void save()} />
        </View>
      </View>

      <FloatingCreateMenu
        actions={[
          {
            key: "new-element",
            label: t("elements.newElementShort"),
            icon: "layers-outline",
            onPress: onCreateElement,
          },
          {
            key: "new-material",
            label: t("elements.newMaterialShort"),
            icon: "cube-outline",
            onPress: onCreateMaterial,
          },
        ]}
        bottomOffset={104}
      />
    </View>
  );
}

function LinkElementsFilters({
  filterSummary,
  filtersOpen,
  linkedFilter,
  sortLabel,
  orderLabel,
  typeFilter,
  bucketFilter,
  onSetLinkedFilter,
  onSetTypeFilter,
  onSetBucketFilter,
  onCycleSort,
  onToggleOrder,
  onToggleFilters,
  t,
}: {
  filterSummary: string;
  filtersOpen: boolean;
  linkedFilter: LinkedFilter;
  sortLabel: string;
  orderLabel: string;
  typeFilter: TypeFilter;
  bucketFilter: BucketFilter;
  onSetLinkedFilter: (value: LinkedFilter) => void;
  onSetTypeFilter: (value: TypeFilter) => void;
  onSetBucketFilter: (value: BucketFilter) => void;
  onCycleSort: () => void;
  onToggleOrder: () => void;
  onToggleFilters: () => void;
  t: TFunction;
}) {
  const { colors } = useDesignTheme();

  return (
    <View className="px-5 pb-2">
      <SurfaceCard className="px-4 py-4">
        <Pressable
          onPress={onToggleFilters}
          className="flex-row items-center justify-between rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
        >
          <View className="min-w-0 flex-1">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {t("linkElements.filtersTitle")}
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
          <View className="mt-4 gap-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <FilterChip
                  active={linkedFilter === "all"}
                  label={t("linkElements.filterAll")}
                  onPress={() => onSetLinkedFilter("all")}
                />
                <FilterChip
                  active={linkedFilter === "linked"}
                  label={t("linkElements.filterLinked")}
                  onPress={() => onSetLinkedFilter("linked")}
                />
                <FilterChip
                  active={linkedFilter === "unlinked"}
                  label={t("linkElements.filterUnlinked")}
                  onPress={() => onSetLinkedFilter("unlinked")}
                />
              </View>
            </ScrollView>

            <View className="flex-row flex-wrap gap-2">
              <ControlPill label={sortLabel} onPress={onCycleSort} />
              <ControlPill label={orderLabel} onPress={onToggleOrder} />
            </View>

            <View>
              <MetaLabel>{t("elements.typeLabel")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  <FilterChip
                    active={typeFilter === "all"}
                    label={t("elements.filterAll")}
                    onPress={() => onSetTypeFilter("all")}
                  />
                  <FilterChip
                    active={typeFilter === "element"}
                    label={t("elements.typeElement")}
                    onPress={() => onSetTypeFilter("element")}
                  />
                  <FilterChip
                    active={typeFilter === "material"}
                    label={t("elements.typeMaterial")}
                    onPress={() => onSetTypeFilter("material")}
                  />
                </View>
              </ScrollView>
            </View>

            <View>
              <MetaLabel>{t("elements.sortBucket")}</MetaLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                <View className="flex-row gap-2">
                  <FilterChip
                    active={bucketFilter === "all"}
                    label={t("elements.filterAll")}
                    onPress={() => onSetBucketFilter("all")}
                  />
                  {COSPLAY_OVERALL_BUCKETS.map((bucket) => (
                    <FilterChip
                      key={bucket}
                      active={bucketFilter === bucket}
                      label={formatOverallBucket(bucket)}
                      onPress={() => onSetBucketFilter(bucket)}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </SurfaceCard>
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

function InfoChip({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-kyar-panel px-3 py-2 dark:bg-kyar-dark-panel">
      <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
        {label}
      </Text>
    </View>
  );
}

function FilterChip({
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
