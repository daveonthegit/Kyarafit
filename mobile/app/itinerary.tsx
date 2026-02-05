import { useCallback, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type {
  Convention,
  ConventionDayPlan,
  Build,
  BuildTask,
  PackingListItem,
} from "@kyarafit/design-system/types";
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

  const [allConventions, setAllConventions] = useState<Convention[]>([]);
  const [convention, setConvention] = useState<Convention | null>(null);
  const [plan, setPlan] = useState<ConventionDayPlan[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [packingItems, setPackingItems] = useState<PackingListItem[]>([]);
  const [tasksByBuildId, setTasksByBuildId] = useState<Map<string, BuildTask[]>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // Default to most recent convention if no conventionId provided
  const conventionId = useMemo(() => {
    if (conventionIdParam) return conventionIdParam;
    if (allConventions.length > 0) {
      const sorted = [...allConventions].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      return sorted[0].id;
    }
    return null;
  }, [conventionIdParam, allConventions]);

  const load = useCallback(async () => {
    const conventions = await listConventions();
    setAllConventions(conventions);

    if (!conventionId) {
      setLoaded(true);
      return;
    }

    const [c, p, bList, packing] = await Promise.all([
      getConvention(conventionId),
      getPlan(conventionId),
      listBuilds(),
      getPacking(conventionId),
    ]);

    setConvention(c);
    setPlan(p ?? []);
    setBuilds(bList);
    setPackingItems(packing);

    // Load tasks for each build in the plan
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
    setTasksByBuildId(tasksMap);
    setLoaded(true);
  }, [conventionId]);

  useFocusEffect(
    useCallback(() => {
      setLoaded(false);
      load();
    }, [load])
  );

  const dates = useMemo(
    () => (convention ? dateRange(convention.startDate, convention.endDate) : []),
    [convention]
  );

  const planByDate = useMemo(() => new Map(plan.map((e) => [e.date, e])), [plan]);

  const conventionTasks = useMemo(
    () => packingItems.filter((item) => !item.buildId),
    [packingItems]
  );

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.metaLabel}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (!conventionId || !convention) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.metaLabel}>No convention selected</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.meta}>Please select a convention to view its itinerary.</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.metaLabel}>Itinerary</Text>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/convention-detail", params: { id: conventionId } })
          }
        >
          <Ionicons name="calendar-outline" size={24} color={colors.black} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{convention.name}</Text>
        <Text style={styles.syncStatus}>Last synced: recently · Available offline</Text>

        {/* Countdown card */}
        {daysUntilStart !== null && (
          <View style={styles.countdownCard}>
            <Text style={styles.cardLabel}>COUNTDOWN</Text>
            <Text style={styles.countdownText}>
              {daysUntilStart > 0
                ? `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`
                : daysUntilStart === 0
                  ? "Starts today!"
                  : `Started ${Math.abs(daysUntilStart)} day${Math.abs(daysUntilStart) === 1 ? "" : "s"} ago`}
            </Text>
          </View>
        )}

        {/* Cosplay Timeline */}
        <View style={styles.timelineHeader}>
          <Text style={styles.sectionTitle}>Cosplay Timeline</Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: "/convention-detail", params: { id: conventionId } })
            }
          >
            <Text style={styles.editLink}>EDIT PLAN</Text>
          </Pressable>
        </View>

        {dates.map((date, idx) => {
          const entry = planByDate.get(date);
          const build = entry?.buildId ? builds.find((b) => b.id === entry.buildId) : null;
          const tasks = entry?.buildId ? tasksByBuildId.get(entry.buildId) || [] : [];
          const buildPacking = packingItems.filter((item) => item.buildId === entry?.buildId);

          let status = "Pending";
          let statusColor: string = colors.textTertiary;

          if (build && entry?.buildId) {
            const totalItems = buildPacking.length;
            const packedItems = buildPacking.filter((item) => item.checked).length;

            if (tasks.length > 0 && tasks.every((t) => t.checked)) {
              status = `Ready to pack (${totalItems} item${totalItems === 1 ? "" : "s"})`;
              statusColor = "#059669";
            } else if (tasks.some((t) => !t.checked)) {
              const missingTasks = tasks.filter((t) => !t.checked);
              if (missingTasks.length <= 2) {
                status = `Missing: ${missingTasks.map((t) => t.label).join(", ")}`;
              } else {
                status = `Missing: ${missingTasks.length} task${missingTasks.length === 1 ? "" : "s"}`;
              }
              statusColor = "#ea580c";
            } else if (totalItems > 0) {
              status = `Ready to pack (${packedItems}/${totalItems} packed)`;
              statusColor = "#059669";
            } else {
              status = "Logistics pending";
            }
          }

          return (
            <View key={date} style={styles.dayEntry}>
              {idx < dates.length - 1 && <View style={styles.timelineConnector} />}
              <View style={styles.dayRow}>
                <View style={styles.dayDot}>
                  <Text style={styles.dayDotText}>{idx + 1}</Text>
                </View>
                <View style={styles.dayContent}>
                  <View style={styles.dayLabelRow}>
                    <Text style={styles.dayLabel}>D{idx + 1}</Text>
                  </View>
                  <Text style={styles.dayDate}>{formatDate(date)}</Text>

                  {build ? (
                    <View style={styles.buildCard}>
                      <View style={styles.buildCardContent}>
                        {build.imageUrl ? (
                          <Image source={{ uri: build.imageUrl }} style={styles.buildImage} />
                        ) : (
                          <View style={[styles.buildImage, styles.placeholderImage]}>
                            <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
                          </View>
                        )}
                        <View style={styles.buildInfo}>
                          <Text style={styles.buildName} numberOfLines={1}>
                            {build.name}
                          </Text>
                          <Text style={styles.buildDate}>{date}</Text>
                          <Text style={[styles.buildStatus, { color: statusColor }]}>{status}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.restDayCard}>
                      <Text style={styles.restDayText}>Rest day</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

        {/* Logistics */}
        <View style={styles.logisticsSection}>
          <Text style={styles.sectionTitle}>Logistics</Text>

          <View style={styles.logisticsCard}>
            <Text style={styles.cardLabel}>ACCOMMODATION</Text>
            {convention.location ? (
              <View>
                <Text style={styles.logisticsText}>{convention.location}</Text>
                <Text style={styles.logisticsSubtext}>Check-in: {convention.startDate}</Text>
              </View>
            ) : (
              <Text style={styles.logisticsPlaceholder}>No accommodation details added yet</Text>
            )}
          </View>

          <View style={styles.logisticsCard}>
            <Text style={styles.cardLabel}>BADGE / TICKET</Text>
            <Text style={styles.logisticsText}>Convention Badge</Text>
            <Text style={styles.logisticsSubtext}>Available offline</Text>
          </View>

          <Text style={styles.syncFooter}>Last synced: recently · Available offline</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  metaLabel: {
    flex: 1,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 24,
    paddingBottom: 120,
  },
  title: {
    fontFamily: font.serif,
    fontSize: 24,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
  },
  syncStatus: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.textTertiary,
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 16,
  },
  countdownCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 16,
    marginTop: 24,
  },
  cardLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: 8,
  },
  countdownText: {
    fontFamily: font.serif,
    fontSize: 20,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 32,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: font.serif,
    fontSize: 20,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
  },
  editLink: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    textDecorationLine: "underline",
    color: colors.text,
  },
  dayEntry: {
    position: "relative",
    marginBottom: 24,
  },
  timelineConnector: {
    position: "absolute",
    left: 12,
    top: 32,
    bottom: 0,
    width: 1,
    backgroundColor: colors.borderSubtle,
  },
  dayRow: {
    flexDirection: "row",
    gap: 16,
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  dayDotText: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.text,
  },
  dayContent: {
    flex: 1,
  },
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  dayLabel: {
    fontFamily: font.serif,
    fontSize: 18,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
  },
  dayDate: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.textTertiary,
    marginTop: 2,
    marginBottom: 12,
  },
  buildCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
    backgroundColor: colors.white,
  },
  buildCardContent: {
    flexDirection: "row",
    gap: 12,
  },
  buildImage: {
    width: 64,
    height: 80,
    borderRadius: 2,
  },
  placeholderImage: {
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  buildInfo: {
    flex: 1,
  },
  buildName: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.text,
  },
  buildDate: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  buildStatus: {
    fontSize: 10,
    marginTop: 8,
  },
  restDayCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderStyle: "dashed",
    padding: 12,
    backgroundColor: `${colors.muted}4D`,
  },
  restDayText: {
    fontSize: 12,
    fontStyle: "italic",
    color: colors.textTertiary,
  },
  logisticsSection: {
    marginTop: 32,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  logisticsCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 16,
    marginTop: 12,
  },
  logisticsText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
    marginTop: 4,
  },
  logisticsSubtext: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
  },
  logisticsPlaceholder: {
    fontSize: 11,
    fontStyle: "italic",
    color: colors.textTertiary,
    marginTop: 4,
  },
  syncFooter: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 24,
  },
});
