import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { ClosetItem } from "@kyarafit/design-system/types";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { listItems } from "../src/storage/closetRepo";
import { getLinkedClosetItemIds, linkBuildItems } from "../src/storage/buildsRepo";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { useTranslation } from "react-i18next";

export default function BuildLinkItemsScreen() {
  const { t } = useTranslation();
  const { buildId: buildIdParam } = useLocalSearchParams<{ buildId?: string }>();
  const buildId =
    typeof buildIdParam === "string"
      ? buildIdParam
      : Array.isArray(buildIdParam)
        ? buildIdParam[0]
        : undefined;
  const router = useRouter();
  const { userId } = useCurrentUser();

  const convexItems = useQuery(api.closetItems.list, userId ? { userId } : "skip");
  const linkedConvex = useQuery(
    api.builds.getItems,
    userId && buildId ? { buildId: buildId as Id<"builds"> } : "skip"
  );
  const addItemsToBuild = useMutation(api.builds.addItemsToBuild);
  const removeItemFromBuild = useMutation(api.builds.removeItemFromBuild);

  const [items, setItems] = useState<ClosetItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);

  const isCloud = !!userId && !!buildId;

  useEffect(() => {
    if (!buildId || isCloud) {
      if (!isCloud && !buildId) setLocalLoaded(false);
      return;
    }
    (async () => {
      const [list, linked] = await Promise.all([listItems(), getLinkedClosetItemIds(buildId)]);
      setItems(list);
      setSelectedIds(new Set(linked));
      setLocalLoaded(true);
    })();
  }, [buildId, isCloud]);

  useEffect(() => {
    if (!isCloud || linkedConvex === undefined || !buildId) return;
    setSelectedIds(new Set(linkedConvex.map((id) => id as string)));
  }, [isCloud, linkedConvex, buildId]);

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
      if (isCloud && userId) {
        const bid = buildId as Id<"builds">;
        const prev = new Set((linkedConvex ?? []).map((x) => x as string));
        const next = selectedIds;
        const toAdd = [...next].filter((id) => !prev.has(id)) as Id<"closetItems">[];
        const toRemove = [...prev].filter((id) => !next.has(id)) as Id<"closetItems">[];
        if (toAdd.length > 0) {
          await addItemsToBuild({ userId, buildId: bid, closetItemIds: toAdd });
        }
        for (const cid of toRemove) {
          await removeItemFromBuild({ userId, buildId: bid, closetItemId: cid });
        }
      } else {
        await linkBuildItems(buildId, Array.from(selectedIds));
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const displayRows = isCloud
    ? (convexItems ?? []).map((c) => ({
        id: c._id as string,
        name: c.name,
        category: c.category ?? "",
      }))
    : items.map((i) => ({ id: i.id, name: i.name, category: i.category }));

  const loading = isCloud ? convexItems === undefined || linkedConvex === undefined : !localLoaded;

  if (!buildId) {
    return (
      <View className="flex-1 bg-white justify-center px-6">
        <Text className="text-sm text-black/50">{t("BuildLinkItems.missingBuildId")}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/50">
            {t("BuildLinkItems.cancel")}
          </Text>
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          {t("BuildLinkItems.title")}
        </Text>
        <Pressable onPress={save} disabled={saving || loading}>
          <Text className="text-[10px] uppercase tracking-[0.2em] font-semibold text-black">
            {saving ? t("BuildLinkItems.saving") : t("BuildLinkItems.save")}
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
          <Text className="text-xs text-black/40 mb-6">{t("BuildLinkItems.hint")}</Text>
          {displayRows.map((item) => (
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
      )}
    </View>
  );
}
