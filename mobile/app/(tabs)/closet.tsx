import { useCallback, useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { CLOSET_CATEGORIES, type ClosetCategory } from "@kyarafit/design-system/types";
import { listItems } from "../../src/storage/closetRepo";
import { useDataSource } from "../../src/hooks/useDataSource";
import { FilterTabs, KyarIcon, ScreenHeader, EmptyState } from "../../src/components/shared";
import { colors } from "@kyarafit/design-system/rn";
import { useTranslation } from "react-i18next";

type CategoryFilter = "all" | ClosetCategory;

const CATEGORY_ORDER: CategoryFilter[] = ["all", ...CLOSET_CATEGORIES];

type ClosetRow = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  imageLocalUri?: string;
};

function categoryToConvex(cat: CategoryFilter): string | undefined {
  if (cat === "all") return undefined;
  return cat;
}

export default function ClosetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId, isCloud } = useDataSource();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const categoryTabs = useMemo(
    () =>
      CATEGORY_ORDER.map((id) => ({
        id,
        label: id === "all" ? t("Closet.categoryAll") : t(`Closet.category.${id}`),
      })),
    [t]
  );

  const convexListArgs = useMemo(() => {
    if (!userId) return "skip" as const;
    const q = search.trim();
    return {
      userId,
      category: categoryToConvex(activeCategory),
      search: q.length ? q : undefined,
      sortBy: "name" as const,
      order: "asc" as const,
    };
  }, [userId, activeCategory, search]);

  const convexItems = useQuery(api.closetItems.list, convexListArgs);

  const [localItems, setLocalItems] = useState<ClosetRow[]>([]);
  const [localLoading, setLocalLoading] = useState(!isCloud);

  useFocusEffect(
    useCallback(() => {
      if (!isCloud) {
        setLocalLoading(true);
        listItems().then((list) => {
          setLocalItems(
            list.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              imageUrl: item.imageUrl,
              imageLocalUri: item.imageLocalUri,
            }))
          );
          setLocalLoading(false);
        });
      }
    }, [isCloud])
  );

  const loading = isCloud ? convexItems === undefined : localLoading;

  const items: ClosetRow[] = isCloud
    ? (convexItems ?? []).map((item) => ({
        id: item._id as string,
        name: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        imageLocalUri: undefined,
      }))
    : localItems;

  const filtered = useMemo(() => {
    if (isCloud) return items;
    const q = search.trim().toLowerCase();
    let rows =
      activeCategory === "all"
        ? items
        : items.filter((i) => i.category.toLowerCase() === activeCategory);
    if (q) {
      rows = rows.filter((i) => i.name.toLowerCase().includes(q));
    }
    return rows;
  }, [isCloud, items, activeCategory, search]);

  const renderItem = ({ item }: { item: ClosetRow }) => (
    <Pressable
      className="flex-1 mb-6"
      onPress={() =>
        router.push({
          pathname: "/closet-detail",
          params: { id: item.id },
        } as unknown as Parameters<typeof router.push>[0])
      }
    >
      <View className="aspect-[3/4] bg-[#F9F9F9] mb-2 overflow-hidden rounded">
        {item.imageLocalUri || item.imageUrl ? (
          <Image
            source={{ uri: item.imageLocalUri || item.imageUrl || undefined }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <KyarIcon name="checkroom" size={32} color="rgba(0,0,0,0.2)" />
          </View>
        )}
      </View>
      <View className="px-1 gap-1">
        <Text className="text-sm font-semibold text-black" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-[10px] uppercase tracking-widest text-black/40">{item.category}</Text>
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        meta={t("Closet.metaInventory")}
        title={t("Closet.titleTheCloset")}
        bottomPadding={0}
      />
      <View className="px-6 pt-2 pb-2 flex-row items-center border-b border-black/5">
        <KyarIcon name="search" size={22} color={colors.textTertiary} />
        <TextInput
          className="flex-1 ml-2 text-sm text-black py-2 border-b border-black/10"
          placeholder={t("Closet.searchPlaceholder")}
          placeholderTextColor="rgba(0,0,0,0.35)"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <FilterTabs
        tabs={categoryTabs}
        active={activeCategory}
        onChange={(id) => setActiveCategory(id as CategoryFilter)}
      />

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 24, paddingBottom: 140 }}
        columnWrapperStyle={{ gap: 16 }}
        ListEmptyComponent={
          loading ? (
            <Text className="text-center mt-16 text-sm text-black/40">{t("Closet.loading")}</Text>
          ) : (
            <View className="mt-8 px-2">
              <EmptyState
                icon="checkroom"
                message={t("Closet.emptyList")}
                secondary={t("Closet.emptyListSecondary")}
              />
            </View>
          )
        }
      />
    </View>
  );
}
