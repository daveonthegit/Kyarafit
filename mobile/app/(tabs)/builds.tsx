import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { listBuilds } from "../../src/storage/buildsRepo";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";

type TabFilter = "all" | "current" | "archived" | "planning" | "completed";

type BuildRow = {
  id: string;
  name: string;
  status: BuildStatus;
  character?: string;
  imageUrl?: string;
  tasksChecked: number;
  tasksTotal: number;
};

export default function BuildsScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();

  const convexBuilds = useQuery(api.builds.list, userId ? { userId } : "skip");
  const [localBuilds, setLocalBuilds] = useState<BuildRow[]>([]);
  const [localLoading, setLocalLoading] = useState(!userId);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
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
    }, [userId])
  );

  const isCloud = !!userId;
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

  const getStatusForTab = (tab: TabFilter): BuildStatus | null => {
    switch (tab) {
      case "all":
        return null;
      case "current":
        return "wip";
      case "planning":
        return "idea";
      case "completed":
        return "ready";
      case "archived":
        return "archived";
    }
  };

  const filteredBuilds =
    getStatusForTab(activeTab) === null
      ? rawBuilds
      : rawBuilds.filter((b) => b.status === getStatusForTab(activeTab));

  return (
    <View className="flex-1 bg-white">
      <View className="bg-white pt-14 border-b border-black/5">
        <View className="flex-row justify-between items-end px-6 pb-4">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-1">
              Portfolio
            </Text>
            <Text className="font-serif text-[28px] font-bold italic text-black tracking-tight">
              My Builds
            </Text>
          </View>
          <Pressable
            className="flex-row items-center gap-2 border border-black px-3 py-1.5"
            onPress={() => router.push("/closet")}
          >
            <Ionicons name="cube-outline" size={14} color="#000" />
            <Text className="text-[9px] uppercase tracking-[0.2em] font-bold text-black">
              Closet
            </Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 py-3">
          {(["all", "current", "planning", "completed", "archived"] as TabFilter[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`px-4 py-2 mr-6 ${activeTab === tab ? "border-b border-black" : ""}`}
            >
              <Text
                className={`text-[11px] uppercase tracking-[0.15em] ${activeTab === tab ? "font-semibold text-black" : "text-black/40"}`}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140, paddingTop: 16 }}>
        {loading && <Text className="text-xs text-black/50 px-6 py-6">Loading…</Text>}
        {!loading && rawBuilds.length === 0 && (
          <Text className="text-xs text-black/50 px-6 py-6">
            No builds yet. Create one to link closet items and use them in convention packing.
          </Text>
        )}
        {!loading && filteredBuilds.length === 0 && rawBuilds.length > 0 && (
          <Text className="text-xs text-black/50 px-6 py-6">No builds in this category.</Text>
        )}

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
                      <Ionicons name="image-outline" size={32} color="rgba(0,0,0,0.4)" />
                    </View>
                  )}
                </Pressable>

                <View className="gap-1">
                  <Text className="text-[8px] tracking-[0.2em] uppercase text-black/50 font-semibold mb-1">
                    PROJECT {projectNumber}
                  </Text>
                  <Text className="font-serif text-lg italic text-black tracking-tight leading-tight">
                    {b.name}
                  </Text>
                  {b.character && (
                    <Text className="text-[10px] text-black/60 mt-1">{b.character}</Text>
                  )}
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
