import { Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import { formatNodeTypeLabel, formatOverallBucket } from "@kyarafit/design-system/domain";
import { COSPLAY_CATEGORIES } from "@kyarafit/design-system/types";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { Button, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

export type NodeLinkCandidate = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType: CosplayNodeType;
  category?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  overallBucket?: string;
  progressPercent?: number;
  childCount?: number;
};

export function NodeLinkPicker({
  title,
  subtitle,
  candidates,
  emptyLabel,
  searchPlaceholder,
  addLabel,
  onPick,
}: {
  title: string;
  subtitle: string;
  candidates: NodeLinkCandidate[];
  emptyLabel: string;
  searchPlaceholder: string;
  addLabel: string;
  onPick: (id: Id<"cosplayNodes">) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CosplayNodeType>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | string>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = candidates.filter((candidate) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch =
      !needle ||
      candidate.name.toLowerCase().includes(needle) ||
      (candidate.category ?? "").toLowerCase().includes(needle);
    const matchesType = typeFilter === "all" || candidate.nodeType === typeFilter;
    const matchesCategory =
      categoryFilter === "all" || (candidate.category ?? "other") === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <View className="px-5 pb-3 pt-4">
        <SectionHeading title={title} />

        <SurfaceCard className="mt-4 px-4 py-4">
          <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {subtitle}
          </Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textTertiary}
            className="mt-4 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
          />

          <View className="mt-4">
            <MetaLabel>{t("elements.typeLabel")}</MetaLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              <View className="flex-row gap-2">
                <ChoicePill
                  active={typeFilter === "all"}
                  label={t("elements.filterAll")}
                  onPress={() => setTypeFilter("all")}
                />
                <ChoicePill
                  active={typeFilter === "element"}
                  label={t("elements.typeElement")}
                  onPress={() => setTypeFilter("element")}
                />
                <ChoicePill
                  active={typeFilter === "material"}
                  label={t("elements.typeMaterial")}
                  onPress={() => setTypeFilter("material")}
                />
              </View>
            </ScrollView>
          </View>

          <View className="mt-4">
            <MetaLabel>{t("elements.categoryLabel")}</MetaLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              <View className="flex-row gap-2">
                <ChoicePill
                  active={categoryFilter === "all"}
                  label={t("elements.filterAll")}
                  onPress={() => setCategoryFilter("all")}
                />
                {COSPLAY_CATEGORIES.map((category) => (
                  <ChoicePill
                    key={category}
                    active={categoryFilter === category}
                    label={category}
                    onPress={() => setCategoryFilter(category)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </SurfaceCard>
      </View>

      <FlatList
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 132,
          gap: 12,
        }}
        ListHeaderComponent={
          <Text className="pb-3 text-[10px] font-bold uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta">
            {t("elements.linkResultsCount", { count: filtered.length })}
          </Text>
        }
        ListEmptyComponent={
          <Text className="py-12 text-center text-kyar-meta dark:text-kyar-dark-meta">
            {emptyLabel}
          </Text>
        }
        renderItem={({ item }) => (
          <SurfaceCard className="mb-3 overflow-hidden">
            <View className="flex-row items-center gap-3 px-4 py-4">
              {item.imageStorageId || item.imageUrl ? (
                <ConvexStorageImage
                  storageId={item.imageStorageId}
                  imageUrl={item.imageUrl}
                  className="h-20 w-20 rounded-2xl"
                  accessibilityLabel={item.name}
                />
              ) : (
                <View className="h-20 w-20 items-center justify-center rounded-2xl bg-kyar-panel dark:bg-kyar-dark-panel">
                  <Text className="text-3xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                    {item.nodeType === "material" ? "◇" : "◆"}
                  </Text>
                </View>
              )}

              <View className="min-w-0 flex-1">
                <MetaLabel>
                  {formatNodeTypeLabel(item.nodeType)}
                  {item.category ? ` · ${item.category}` : ""}
                </MetaLabel>
                <Text
                  className="mt-1 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                  numberOfLines={1}
                >
                  {typeof item.progressPercent === "number"
                    ? t("elements.progressPercent", { pct: item.progressPercent })
                    : formatNodeTypeLabel(item.nodeType)}
                  {item.overallBucket ? ` · ${formatOverallBucket(item.overallBucket)}` : ""}
                </Text>
                {typeof item.childCount === "number" && item.childCount > 0 ? (
                  <Text className="mt-1 text-xs text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                    {t("elements.childCount", { count: item.childCount })}
                  </Text>
                ) : null}
              </View>

              <Button
                title={pendingId === (item._id as string) ? "Adding…" : addLabel}
                onPress={() => {
                  setPendingId(item._id as string);
                  void onPick(item._id)
                    .catch((error) => {
                      Alert.alert(
                        t("common.errorTitle"),
                        String(error instanceof Error ? error.message : error)
                      );
                    })
                    .finally(() => setPendingId(null));
                }}
                loading={pendingId === (item._id as string)}
                disabled={pendingId !== null}
              />
            </View>
          </SurfaceCard>
        )}
      />
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
      className={`rounded-full border px-4 py-2 ${
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
