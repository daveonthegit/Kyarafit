import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { Convention } from "@kyarafit/design-system/types";
import { listConventions } from "../../src/storage/conventionsRepo";
import { getSyncPendingCount } from "../../src/services/sync";

export default function PlanScreen() {
  const router = useRouter();
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncPending, setSyncPending] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, pending] = await Promise.all([
      listConventions(),
      getSyncPendingCount(),
    ]);
    setConventions(list);
    setSyncPending(pending);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.metaLabel}>Circuit</Text>
          <Text style={styles.title}>Conventions</Text>
          {syncPending > 0 && (
            <Text style={styles.syncLabel}>
              SYNC PENDING — WILL SYNC WHEN ONLINE
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() =>
              router.push({ pathname: "/convention-new", params: {} })
            }
          >
            <Text style={styles.primaryBtnText}>NEW CONVENTION</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {loading && <Text style={styles.meta}>Loading…</Text>}
          {!loading && conventions.length === 0 && (
            <Text style={styles.meta}>
              No conventions yet. Create one to plan days and generate packing
              lists.
            </Text>
          )}
          {conventions.map((c) => (
            <Pressable
              key={c.id}
              style={styles.conventionRow}
              onPress={() =>
                router.push({
                  pathname: "/convention-detail",
                  params: { id: c.id },
                })
              }
            >
              <Text style={styles.conventionName}>{c.name}</Text>
              <Text style={styles.conventionMeta}>
                {c.startDate} – {c.endDate}
                {c.location ? ` · ${c.location}` : ""}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textTertiary}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  header: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
    paddingBottom: 16,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginBottom: 4,
  },
  title: {
    fontFamily: font.serif,
    fontSize: 28,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    letterSpacing: -0.5,
  },
  syncLabel: {
    marginTop: 8,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  actions: {
    paddingHorizontal: layout.screenPaddingX,
    marginBottom: layout.stackGap,
  },
  primaryBtn: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 2,
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.white,
  },
  list: { paddingHorizontal: layout.screenPaddingX, gap: 0 },
  conventionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  conventionName: {
    flex: 1,
    fontFamily: font.serif,
    fontSize: 20,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
  },
  conventionMeta: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  meta: { fontSize: 12, color: colors.meta, paddingVertical: 24 },
});
