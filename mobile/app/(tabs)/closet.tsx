import { useCallback, useState } from "react";
import { View, Text, Image, ScrollView, Pressable, FlatList } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { listItems } from "../../src/storage/closetRepo";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";

type ClosetRow = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  imageLocalUri?: string;
};

const CATEGORIES = ["All Items", "Wig", "Prop", "Armor", "Garment", "Shoe", "Material", "Other"];

export default function ClosetScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();

  const convexItems = useQuery(api.closetItems.list, userId ? { userId } : "skip");
  const [localItems, setLocalItems] = useState<ClosetRow[]>([]);
  const [localLoading, setLocalLoading] = useState(!userId);
  const [activeCategory, setActiveCategory] = useState("All Items");

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
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
    }, [userId])
  );

  const isCloud = !!userId;
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

  const filtered =
    activeCategory === "All Items"
      ? items
      : items.filter((i) => i.category.toLowerCase() === activeCategory.toLowerCase());

  const renderItem = ({ item }: { item: ClosetRow }) => (
    <View className="flex-1 mb-6">
      <View className="aspect-[3/4] bg-[#F9F9F9] mb-2 overflow-hidden rounded">
        {item.imageLocalUri || item.imageUrl ? (
          <Image
            source={{ uri: item.imageLocalUri || item.imageUrl || undefined }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Ionicons name="shirt-outline" size={32} color="rgba(0,0,0,0.2)" />
          </View>
        )}
      </View>
      <View className="px-1 gap-1">
        <Text className="text-sm font-semibold text-black" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-[10px] uppercase tracking-widest text-black/40">{item.category}</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <View className="bg-white pt-14 border-b border-black/5">
        <View className="flex-row justify-between items-end px-6 pb-4">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-1">
              Inventory
            </Text>
            <Text className="font-serif text-[28px] font-bold italic text-black tracking-tight">
              The Closet
            </Text>
          </View>
          <View className="flex-row items-center gap-4">
            <Pressable>
              <Ionicons name="search-outline" size={24} color="#000" />
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 py-3">
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setActiveCategory(cat)}
              className={`px-4 py-2 mr-6 ${activeCategory === cat ? "border-b border-black" : ""}`}
            >
              <Text
                className={`text-[11px] uppercase tracking-[0.15em] ${activeCategory === cat ? "font-semibold text-black" : "text-black/40"}`}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: 24, paddingBottom: 140 }}
        columnWrapperStyle={{ gap: 16 }}
        ListEmptyComponent={
          loading ? (
            <Text className="text-center mt-16 text-sm text-black/40">Loading…</Text>
          ) : (
            <Text className="text-center mt-16 text-sm text-black/40">No items yet.</Text>
          )
        }
      />
    </View>
  );
}
