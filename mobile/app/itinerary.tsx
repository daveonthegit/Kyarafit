import { useCallback, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type {
  Convention,
  ConventionDayPlan,
  Build,
  BuildTask,
  PackingListItem,
} from "@kyarafit/design-system/types";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { getConvention, listConventions } from "../src/storage/conventionsRepo";
import { getPlan } from "../src/storage/plansRepo";
import { listBuilds } from "../src/storage/buildsRepo";
import { listTasks } from "../src/storage/buildTasksRepo";
import { getPacking } from "../src/storage/packingRepo";

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function ItineraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conventionId?: string }>();
  const conventionIdParam =
    typeof params.conventionId === "string"
      ? params.conventionId
      : Array.isArray(params.conventionId)
        ? params.conventionId[0]
        : undefined;

  const { userId } = useCurrentUser();

  const convexConventions = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const allConventionsFromCloud = useMemo(
    () =>
      (convexConventions ?? []).map((c) => ({
        id: c._id,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        location: c.location,
      })),
    [convexConventions]
  );
  const conventionIdFromCloud = useMemo(() => {
    if (conventionIdParam) return conventionIdParam;
    if (allConventionsFromCloud.length > 0) {
      const sorted = [...allConventionsFromCloud].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      return sorted[0].id;
    }
    return null;
  }, [conventionIdParam, allConventionsFromCloud]);

  const convexConvention = useQuery(
    api.conventions.get,
    userId && conventionIdFromCloud ? { id: conventionIdFromCloud as Id<"conventions"> } : "skip"
  );
  const convexPlan = useQuery(
    api.conventions.getPlan,
    userId && conventionIdFromCloud
      ? { conventionId: conventionIdFromCloud as Id<"conventions"> }
      : "skip"
  );
  const convexBuilds = useQuery(api.builds.list, userId ? { userId } : "skip");
  const convexPacking = useQuery(
    api.conventions.getPacking,
    userId && conventionIdFromCloud
      ? { conventionId: conventionIdFromCloud as Id<"conventions"> }
      : "skip"
  );
  const buildIdsForTasks = useMemo(() => {
    const plan = convexPlan ?? [];
    const ids: Id<"builds">[] = [];
    const seen = new Set<string>();
    plan.forEach((e) => {
      if (e.buildId && !seen.has(e.buildId)) {
        seen.add(e.buildId);
        ids.push(e.buildId);
      }
    });
    return ids;
  }, [convexPlan]);
  const convexTasksByBuilds = useQuery(
    api.buildTasks.listByBuilds,
    userId && buildIdsForTasks.length > 0 ? { buildIds: buildIdsForTasks } : "skip"
  );

  const [localConventions, setLocalConventions] = useState<Convention[]>([]);
  const [localConvention, setLocalConventionOne] = useState<Convention | null>(null);
  const [localPlan, setLocalPlan] = useState<ConventionDayPlan[]>([]);
  const [localBuilds, setLocalBuilds] = useState<Build[]>([]);
  const [localPacking, setLocalPacking] = useState<PackingListItem[]>([]);
  const [localTasksByBuildId, setLocalTasksByBuildId] = useState<Map<string, BuildTask[]>>(
    new Map()
  );
  const [localLoaded, setLocalLoaded] = useState(false);

  const conventionId = userId
    ? conventionIdFromCloud
    : (conventionIdParam ??
      (localConventions.length > 0
        ? [...localConventions].sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )[0].id
        : null));

  const load = useCallback(async () => {
    if (userId) return;
    const conventions = await listConventions();
    setLocalConventions(conventions);
    const cid =
      conventionIdParam ??
      (conventions.length > 0
        ? [...conventions].sort(
            (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )[0].id
        : null);
    if (!cid) {
      setLocalLoaded(true);
      return;
    }
    const [c, p, bList, packing] = await Promise.all([
      getConvention(cid),
      getPlan(cid),
      listBuilds(),
      getPacking(cid),
    ]);
    setLocalConventionOne(c);
    setLocalPlan(p ?? []);
    setLocalBuilds(bList);
    setLocalPacking(packing);
    const uniqueBuildIds = new Set<string>();
    (p ?? []).forEach((entry) => {
      if (entry.buildId) uniqueBuildIds.add(entry.buildId);
    });
    const tasksMap = new Map<string, BuildTask[]>();
    await Promise.all(
      Array.from(uniqueBuildIds).map(async (buildId) => {
        const tasks = await listTasks(buildId);
        tasksMap.set(buildId, tasks);
      })
    );
    setLocalTasksByBuildId(tasksMap);
    setLocalLoaded(true);
  }, [conventionIdParam, userId]);

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

  const builds: Build[] = isCloud
    ? (convexBuilds ?? []).map((b) => ({
        id: b._id as string,
        name: b.name,
        status: b.status as Build["status"],
        character: b.character,
        imageUrl: b.imageUrl,
        budgetCents: b.budgetCents,
        targetDate: b.targetDate,
        tasksTotal: b.tasksTotal ?? 0,
        tasksChecked: b.tasksChecked ?? 0,
        createdAt: "",
        updatedAt: "",
      }))
    : localBuilds;

  const packingItems: PackingListItem[] = isCloud
    ? (convexPacking ?? []).map((p) => ({
        id: p._id,
        conventionId: p.conventionId as string,
        label: p.label,
        checked: p.checked,
        date: p.date ?? null,
        buildId: p.buildId ? (p.buildId as string) : null,
        closetItemId: p.closetItemId ? (p.closetItemId as string) : null,
        createdAt: "",
        updatedAt: "",
      }))
    : localPacking;

  const tasksByBuildId = useMemo(() => {
    if (isCloud && convexTasksByBuilds) {
      const map = new Map<string, BuildTask[]>();
      convexTasksByBuilds.forEach(({ buildId, tasks }) => {
        map.set(
          buildId as string,
          tasks.map((t) => ({
            id: t._id,
            buildId: t.buildId,
            label: t.label,
            closetItemId: t.closetItemId ?? undefined,
            sortOrder: t.sortOrder,
            checked: t.checked,
            createdAt: "",
            updatedAt: "",
          }))
        );
      });
      return map;
    }
    return localTasksByBuildId;
  }, [isCloud, convexTasksByBuilds, localTasksByBuildId]);

  const loaded = isCloud
    ? conventionIdFromCloud
      ? convexConvention !== undefined &&
        convexPlan !== undefined &&
        convexBuilds !== undefined &&
        convexPacking !== undefined &&
        (buildIdsForTasks.length === 0 || convexTasksByBuilds !== undefined)
      : convexConventions !== undefined
    : localLoaded;

  const dates = useMemo(
    () => (convention ? dateRange(convention.startDate, convention.endDate) : []),
    [convention]
  );

  const planByDate = useMemo(() => new Map(plan.map((e) => [e.date, e])), [plan]);

  const daysUntilStart = useMemo(() => {
    if (!convention) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(convention.startDate);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [convention]);

  if (!loaded) {
    return (
      <View className="flex-1 bg-white">
        <View className="pt-14 pb-4 px-6 border-b border-black/5">
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
            Loading…
          </Text>
        </View>
      </View>
    );
  }

  if (!conventionId || !convention) {
    return (
      <View className="flex-1 bg-white">
        <View className="pt-14 pb-4 px-6 border-b border-black/5">
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
            No convention selected
          </Text>
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <Text className="text-xs text-black/40">
            Please select a convention to view its itinerary.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5 bg-white/95">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text className="flex-1 text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          Itinerary
        </Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/convention-detail", params: { id: conventionId } })
          }
        >
          <Ionicons name="calendar-outline" size={24} color="#000" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 }}
      >
        <Text className="font-serif text-2xl font-bold italic text-black">{convention.name}</Text>
        <Text className="text-[9px] uppercase tracking-[0.15em] text-black/40 mt-1.5">
          Last synced: recently · Available offline
        </Text>

        {daysUntilStart !== null && (
          <View className="border border-black/10 p-4 mt-6">
            <Text className="text-[9px] uppercase tracking-[0.2em] text-black/40 mb-2">
              COUNTDOWN
            </Text>
            <Text className="font-serif text-xl font-bold italic text-black">
              {daysUntilStart > 0
                ? `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`
                : daysUntilStart === 0
                  ? "Starts today!"
                  : `Started ${Math.abs(daysUntilStart)} day${Math.abs(daysUntilStart) === 1 ? "" : "s"} ago`}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between items-baseline mt-8 mb-6">
          <Text className="font-serif text-xl font-bold italic text-black">Cosplay Timeline</Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/convention-detail", params: { id: conventionId } })
            }
          >
            <Text className="text-[10px] uppercase tracking-[0.15em] underline text-black">
              EDIT PLAN
            </Text>
          </Pressable>
        </View>

        {dates.map((date, idx) => {
          const entry = planByDate.get(date);
          const build = entry?.buildId ? builds.find((b) => b.id === entry.buildId) : null;
          const tasks = entry?.buildId ? tasksByBuildId.get(entry.buildId) || [] : [];
          const buildPacking = packingItems.filter((item) => item.buildId === entry?.buildId);

          let status = "Pending";
          let statusColor = "text-black/40";

          if (build && entry?.buildId) {
            const totalItems = buildPacking.length;
            const packedItems = buildPacking.filter((item) => item.checked).length;

            if (tasks.length > 0 && tasks.every((t) => t.checked)) {
              status = `Ready to pack (${totalItems} item${totalItems === 1 ? "" : "s"})`;
              statusColor = "text-[#059669]";
            } else if (tasks.some((t) => !t.checked)) {
              const missingTasks = tasks.filter((t) => !t.checked);
              if (missingTasks.length <= 2) {
                status = `Missing: ${missingTasks.map((t) => t.label).join(", ")}`;
              } else {
                status = `Missing: ${missingTasks.length} task${missingTasks.length === 1 ? "" : "s"}`;
              }
              statusColor = "text-[#ea580c]";
            } else if (totalItems > 0) {
              status = `Ready to pack (${packedItems}/${totalItems} packed)`;
              statusColor = "text-[#059669]";
            } else {
              status = "Logistics pending";
            }
          }

          return (
            <View key={date} className="relative mb-6">
              {idx < dates.length - 1 && (
                <View className="absolute left-3 top-8 bottom-0 w-px bg-black/10" />
              )}
              <View className="flex-row gap-4">
                <View className="w-6 h-6 rounded-full border-2 border-black/10 bg-white items-center justify-center mt-0.5">
                  <Text className="text-[10px] font-bold text-black">{idx + 1}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-baseline">
                    <Text className="font-serif text-lg font-bold italic text-black">
                      D{idx + 1}
                    </Text>
                  </View>
                  <Text className="text-[9px] uppercase tracking-[0.15em] text-black/40 mt-0.5 mb-3">
                    {formatDate(date)}
                  </Text>

                  {build ? (
                    <View className="border border-black/10 p-3 bg-white">
                      <View className="flex-row gap-3">
                        {build.imageUrl ? (
                          <Image
                            source={{ uri: build.imageUrl }}
                            className="w-16 h-20 rounded-sm"
                          />
                        ) : (
                          <View className="w-16 h-20 bg-[#F9F9F9] items-center justify-center border border-black/10">
                            <Ionicons name="image-outline" size={24} color="rgba(0,0,0,0.4)" />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text
                            className="text-xs font-bold uppercase tracking-widest text-black"
                            numberOfLines={1}
                          >
                            {build.name}
                          </Text>
                          <Text className="text-[10px] text-black/40 mt-0.5">{date}</Text>
                          <Text className={`text-[10px] mt-2 ${statusColor}`}>{status}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View className="border border-black/10 border-dashed p-3 bg-[#F9F9F9]">
                      <Text className="text-xs italic text-black/40">Rest day</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        <View className="mt-8 pt-8 border-t border-black/10">
          <Text className="font-serif text-xl font-bold italic text-black">Logistics</Text>

          <View className="border border-black/10 p-4 mt-3">
            <Text className="text-[9px] uppercase tracking-[0.2em] text-black/40 mb-2">
              ACCOMMODATION
            </Text>
            {convention.location ? (
              <View>
                <Text className="text-[13px] font-medium text-black mt-1">
                  {convention.location}
                </Text>
                <Text className="text-[11px] text-black/40 mt-1">
                  Check-in: {convention.startDate}
                </Text>
              </View>
            ) : (
              <Text className="text-[11px] italic text-black/40 mt-1">
                No accommodation details added yet
              </Text>
            )}
          </View>

          <View className="border border-black/10 p-4 mt-3">
            <Text className="text-[9px] uppercase tracking-[0.2em] text-black/40 mb-2">
              BADGE / TICKET
            </Text>
            <Text className="text-[13px] font-medium text-black mt-1">Convention Badge</Text>
            <Text className="text-[11px] text-black/40 mt-1">Available offline</Text>
          </View>

          <Text className="text-[9px] uppercase tracking-[0.15em] text-black/40 text-center mt-6">
            Last synced: recently · Available offline
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
