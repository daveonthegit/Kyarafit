import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { Convention, ConventionDayPlan, Build } from "@kyarafit/design-system/types";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { getConvention } from "../src/storage/conventionsRepo";
import { getPlan, setPlan } from "../src/storage/plansRepo";
import { listBuilds } from "../src/storage/buildsRepo";
import { regenerateLocal } from "../src/storage/packingRepo";

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start);
  const endD = new Date(end);
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function ConventionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const router = useRouter();
  const { userId } = useCurrentUser();

  // Convex (when signed in)
  const conventionId = id as Id<"conventions"> | undefined;
  const convexConvention = useQuery(
    api.conventions.get,
    userId && conventionId ? { id: conventionId } : "skip"
  );
  const convexPlan = useQuery(
    api.conventions.getPlan,
    userId && conventionId ? { conventionId } : "skip"
  );
  const convexBuilds = useQuery(api.builds.list, userId ? { userId } : "skip");
  const replacePlanMut = useMutation(api.conventions.replacePlan);
  const regeneratePackingMut = useMutation(api.conventions.regeneratePacking);

  // Local (when anonymous)
  const [localConvention, setLocalConvention] = useState<Convention | null>(null);
  const [localPlan, setLocalPlanState] = useState<ConventionDayPlan[]>([]);
  const [localBuilds, setLocalBuilds] = useState<Build[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id || userId) {
      if (!userId) setLocalLoaded(true);
      return;
    }
    const [c, p, bList] = await Promise.all([getConvention(id), getPlan(id), listBuilds()]);
    if (c) setLocalConvention(c);
    setLocalPlanState(p ?? []);
    setLocalBuilds(bList);
    setLocalLoaded(true);
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) setLocalLoaded(false);
      load();
    }, [load, userId])
  );

  const isCloud = !!userId;
  const convention: Convention | null = isCloud
    ? convexConvention
      ? {
          id: convexConvention._id,
          name: convexConvention.name,
          startDate: convexConvention.startDate,
          endDate: convexConvention.endDate,
          location: convexConvention.location,
          createdAt: "",
          updatedAt: "",
        }
      : null
    : localConvention;

  const plan: ConventionDayPlan[] = isCloud
    ? (convexPlan ?? []).map((e) => ({
        id: e._id,
        conventionId: e.conventionId,
        date: e.date,
        buildId: e.buildId ?? null,
        notes: e.notes,
      }))
    : localPlan;

  const builds: { id: string; name: string }[] = isCloud
    ? (convexBuilds ?? []).map((b) => ({ id: b._id as string, name: b.name }))
    : localBuilds.map((b) => ({ id: b.id, name: b.name }));

  const dates = convention ? dateRange(convention.startDate, convention.endDate) : [];
  const planByDate = new Map(plan.map((e) => [e.date, e]));
  const loaded = isCloud ? convexConvention !== undefined : localLoaded;

  const handleReplacePlan = useCallback(
    async (updates: { date: string; buildId: string | null }[]) => {
      if (!id) return;
      const planByDateCurrent = new Map(plan.map((e) => [e.date, e]));
      const newPlan = dates.map((date) => {
        const u = updates.find((x) => x.date === date);
        const existing = planByDateCurrent.get(date);
        return {
          date,
          buildId: u !== undefined ? u.buildId : (existing?.buildId ?? null),
          notes: existing?.notes,
        };
      });
      if (userId) {
        await replacePlanMut({
          userId,
          conventionId: id as Id<"conventions">,
          plan: newPlan.map((e) => ({
            date: e.date,
            buildId: e.buildId ? (e.buildId as Id<"builds">) : undefined,
            notes: e.notes,
          })),
        });
      } else {
        await setPlan(id, newPlan);
        const updated = await getPlan(id);
        setLocalPlanState(updated ?? []);
      }
      setPickerDate(null);
    },
    [id, dates, plan, userId, replacePlanMut]
  );

  const [regenerating, setRegenerating] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const handleGeneratePacking = useCallback(async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      if (userId) {
        await regeneratePackingMut({ userId, conventionId: id as Id<"conventions"> });
      } else {
        await regenerateLocal(id);
      }
      router.push({
        pathname: "/packing",
        params: { conventionId: id },
      });
    } finally {
      setRegenerating(false);
    }
  }, [id, userId, router, regeneratePackingMut]);

  if (!id) {
    return (
      <View className="flex-1 bg-white justify-center items-center p-6">
        <Text className="text-[10px] uppercase tracking-widest text-black/40">
          Missing convention id.
        </Text>
      </View>
    );
  }
  if (!loaded) {
    return (
      <View className="flex-1 bg-white justify-center items-center p-6">
        <Text className="text-[10px] uppercase tracking-widest text-black/40">Loading…</Text>
      </View>
    );
  }
  if (!convention) {
    return (
      <View className="flex-1 bg-white justify-center items-center p-6">
        <Text className="text-[10px] uppercase tracking-widest text-black/40">
          Convention not found.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          Convention
        </Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="font-serif text-3xl font-bold italic text-black mt-6">
          {convention.name}
        </Text>
        <Text className="text-[10px] uppercase tracking-widest text-black/40 mt-2">
          {convention.startDate} – {convention.endDate}
          {convention.location ? ` · ${convention.location}` : ""}
        </Text>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mt-8 mb-4">
          DAY-BY-DAY PLAN
        </Text>
        {dates.map((date) => {
          const entry = planByDate.get(date);
          const buildName = entry?.buildId
            ? (builds.find((b) => b.id === entry.buildId)?.name ?? "—")
            : "Rest day";
          return (
            <Pressable
              key={date}
              className="flex-row items-center py-3.5 border-b border-black/5 gap-3"
              onPress={() => setPickerDate(date)}
            >
              <Text className="text-xs text-black w-24">{date}</Text>
              <Text className="flex-1 text-sm font-serif italic text-black" numberOfLines={1}>
                {buildName}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.4)" />
            </Pressable>
          );
        })}

        <Pressable
          className={`bg-black py-3.5 mt-8 items-center rounded-full ${regenerating ? "opacity-50" : ""}`}
          onPress={handleGeneratePacking}
          disabled={regenerating}
        >
          <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            GENERATE PACKING LIST
          </Text>
        </Pressable>

        <Pressable
          className="border border-black py-3.5 mt-3 items-center rounded-full"
          onPress={() =>
            router.push({
              pathname: "/packing",
              params: { conventionId: id },
            })
          }
        >
          <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black">
            VIEW PACKING LIST
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={pickerDate !== null} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/30 justify-center p-6"
          onPress={() => setPickerDate(null)}
        >
          <Pressable className="bg-white p-6 rounded" onPress={(e) => e.stopPropagation()}>
            <Text className="font-serif text-lg italic mb-4">Assign build for {pickerDate}</Text>
            <Pressable
              className="py-3 border-b border-black/5"
              onPress={() => pickerDate && handleReplacePlan([{ date: pickerDate, buildId: null }])}
            >
              <Text className="text-sm text-black">Rest day</Text>
            </Pressable>
            {builds.map((b) => (
              <Pressable
                key={b.id}
                className="py-3 border-b border-black/5"
                onPress={() =>
                  pickerDate && handleReplacePlan([{ date: pickerDate, buildId: b.id }])
                }
              >
                <Text className="text-sm text-black">{b.name}</Text>
              </Pressable>
            ))}
            <Pressable className="mt-4 items-center" onPress={() => setPickerDate(null)}>
              <Text className="text-[10px] uppercase tracking-[0.2em] text-black/50">CANCEL</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
