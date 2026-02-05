import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { Convention, ConventionDayPlan, Build } from "@kyarafit/design-system/types";
import { getConvention } from "../src/storage/conventionsRepo";
import { getPlan, setPlan } from "../src/storage/plansRepo";
import { listBuilds } from "../src/storage/buildsRepo";
import { regenerateLocal } from "../src/storage/packingRepo";
import { getSyncPendingCount } from "../src/services/sync";

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
  const [convention, setConvention] = useState<Convention | null>(null);
  const [plan, setPlanState] = useState<ConventionDayPlan[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [syncPending, setSyncPending] = useState(0);
  const [regenerating, setRegenerating] = useState(false);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoaded(true);
      return;
    }
    const [c, p, bList, pending] = await Promise.all([
      getConvention(id),
      getPlan(id),
      listBuilds(),
      getSyncPendingCount(),
    ]);
    if (c) {
      setConvention(c);
      setDates(dateRange(c.startDate, c.endDate));
    }
    setPlanState(p ?? []);
    setBuilds(bList);
    setSyncPending(pending);
    setLoaded(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoaded(false);
      load();
    }, [load])
  );

  const planByDate = new Map(plan.map((e) => [e.date, e]));
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
      await setPlan(id, newPlan);
      const updated = await getPlan(id);
      setPlanState(updated ?? []);
      setPickerDate(null);
    },
    [id, dates, plan]
  );

  const handleGeneratePacking = useCallback(async () => {
    if (!id) return;
    setRegenerating(true);
    try {
      await regenerateLocal(id);
      router.push({
        pathname: "/(tabs)/packing",
        params: { conventionId: id },
      });
    } finally {
      setRegenerating(false);
    }
  }, [id, router]);

  if (!id) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Missing convention id.</Text>
      </View>
    );
  }
  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Loading…</Text>
      </View>
    );
  }
  if (!convention) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Convention not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.metaLabel}>Convention</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{convention.name}</Text>
        <Text style={styles.meta}>
          {convention.startDate} – {convention.endDate}
          {convention.location ? ` · ${convention.location}` : ""}
        </Text>
        {syncPending > 0 && (
          <Text style={styles.syncLabel}>SYNC PENDING — WILL SYNC WHEN ONLINE</Text>
        )}

        <Text style={styles.sectionLabel}>DAY-BY-DAY PLAN</Text>
        {dates.map((date) => {
          const entry = planByDate.get(date);
          const buildName = entry?.buildId
            ? (builds.find((b) => b.id === entry.buildId)?.name ?? "—")
            : "Rest day";
          return (
            <Pressable key={date} style={styles.planRow} onPress={() => setPickerDate(date)}>
              <Text style={styles.planDate}>{date}</Text>
              <Text style={styles.planBuild} numberOfLines={1}>
                {buildName}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          );
        })}

        <Pressable
          style={[styles.primaryBtn, regenerating && styles.disabled]}
          onPress={handleGeneratePacking}
          disabled={regenerating}
        >
          <Text style={styles.primaryBtnText}>GENERATE PACKING LIST</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/packing",
              params: { conventionId: id },
            })
          }
        >
          <Text style={styles.secondaryBtnText}>VIEW PACKING LIST</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={pickerDate !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerDate(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Assign build for {pickerDate}</Text>
            <Pressable
              style={styles.modalOption}
              onPress={() => pickerDate && handleReplacePlan([{ date: pickerDate, buildId: null }])}
            >
              <Text style={styles.optionText}>Rest day</Text>
            </Pressable>
            {builds.map((b) => (
              <Pressable
                key={b.id}
                style={styles.modalOption}
                onPress={() =>
                  pickerDate && handleReplacePlan([{ date: pickerDate, buildId: b.id }])
                }
              >
                <Text style={styles.optionText}>{b.name}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setPickerDate(null)}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: layout.screenPaddingX, paddingBottom: 48 },
  title: {
    fontFamily: font.serif,
    fontSize: 28,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    marginTop: 24,
  },
  meta: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
    marginTop: 8,
  },
  syncLabel: {
    marginTop: 8,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginTop: 32,
    marginBottom: 16,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  planDate: { fontSize: 12, color: colors.text, width: 100 },
  planBuild: {
    flex: 1,
    fontSize: 14,
    fontFamily: font.serif,
    fontStyle: "italic",
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    marginTop: 32,
    alignItems: "center",
    borderRadius: 2,
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.white,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 14,
    marginTop: 12,
    alignItems: "center",
    borderRadius: 2,
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.black,
  },
  disabled: { opacity: 0.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: { backgroundColor: colors.white, padding: 24, borderRadius: 2 },
  modalTitle: {
    fontFamily: font.serif,
    fontSize: 18,
    fontStyle: "italic",
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  optionText: { fontSize: 14, color: colors.text },
  modalCancel: { marginTop: 16, alignItems: "center" },
  cancelText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.meta,
  },
});
