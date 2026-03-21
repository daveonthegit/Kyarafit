import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { ClosetItem } from "@kyarafit/design-system/types";
import { listItems } from "../src/storage/closetRepo";
import { getLinkedClosetItemIds, linkBuildItems } from "../src/storage/buildsRepo";

export default function BuildLinkItemsScreen() {
  const { buildId } = useLocalSearchParams<{ buildId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!buildId) return;
    listItems().then(setItems);
    getLinkedClosetItemIds(buildId).then((ids) => setSelectedIds(new Set(ids)));
  }, [buildId]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!buildId) return;
    setSaving(true);
    try {
      await linkBuildItems(buildId, Array.from(selectedIds));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/50">CANCEL</Text>
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          Link Closet Items
        </Text>
        <Pressable onPress={save} disabled={saving}>
          <Text className="text-[10px] uppercase tracking-[0.2em] font-semibold text-black">
            SAVE
          </Text>
        </Pressable>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="text-xs text-black/40 mb-6">
          Select items to include in this build. They will appear in packing lists when this build
          is assigned to a day.
        </Text>
        {items.map((item) => (
          <Pressable
            key={item.id}
            className="flex-row items-center py-3.5 border-b border-black/5 gap-3"
            onPress={() => toggle(item.id)}
          >
            <View
              className={`w-4 h-4 border items-center justify-center ${selectedIds.has(item.id) ? "bg-black border-black" : "border-black/10"}`}
            >
              {selectedIds.has(item.id) && <View className="w-1.5 h-1.5 bg-white" />}
            </View>
            <Text className="flex-1 text-sm text-black">{item.name}</Text>
            <Text className="text-[10px] uppercase tracking-widest text-black/40">
              {item.category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
