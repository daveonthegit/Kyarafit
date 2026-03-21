import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { listConventions } from "../src/storage/conventionsRepo";
import { useCurrentUser } from "../src/hooks/useCurrentUser";

type ConventionRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
};

export default function PlanScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();

  const convexConventions = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const [localConventions, setLocalConventions] = useState<ConventionRow[]>([]);
  const [localLoading, setLocalLoading] = useState(!userId);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setLocalLoading(true);
        listConventions().then((list) => {
          setLocalConventions(
            list.map((c) => ({
              id: c.id,
              name: c.name,
              startDate: c.startDate,
              endDate: c.endDate,
              location: c.location,
            }))
          );
          setLocalLoading(false);
        });
      }
    }, [userId])
  );

  const isCloud = !!userId;
  const loading = isCloud ? convexConventions === undefined : localLoading;

  const conventions: ConventionRow[] = isCloud
    ? (convexConventions ?? []).map((c) => ({
        id: c._id as string,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        location: c.location,
      }))
    : localConventions;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          Circuit
        </Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="px-6 pt-6 pb-4">
          <Text className="font-serif text-[28px] font-bold italic text-black tracking-tight mb-2">
            Conventions
          </Text>
          {isCloud && (
            <Text className="text-[9px] uppercase tracking-[0.15em] font-semibold text-black/50">
              SYNCED TO CLOUD
            </Text>
          )}
        </View>

        <View className="px-6 mb-6">
          <Pressable
            className="bg-black py-3.5 items-center justify-center rounded-full"
            onPress={() => router.push({ pathname: "/convention-new", params: {} })}
          >
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              NEW CONVENTION
            </Text>
          </Pressable>
        </View>

        <View className="px-6">
          {loading && <Text className="text-xs text-black/50 py-6">Loading…</Text>}
          {!loading && conventions.length === 0 && (
            <Text className="text-xs text-black/50 py-6">
              No conventions yet. Create one to plan days and generate packing lists.
            </Text>
          )}
          {conventions.map((c) => (
            <Pressable
              key={c.id}
              className="flex-row items-center py-5 border-b border-black/5 gap-3"
              onPress={() =>
                router.push({
                  pathname: "/convention-detail",
                  params: { id: c.id },
                })
              }
            >
              <View className="flex-1">
                <Text className="font-serif text-xl font-bold italic text-black">{c.name}</Text>
                <Text className="text-[10px] uppercase tracking-widest text-black/40 mt-1">
                  {c.startDate} – {c.endDate}
                  {c.location ? ` · ${c.location}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
