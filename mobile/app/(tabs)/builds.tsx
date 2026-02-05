import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { Build } from "@kyarafit/design-system/types";
import { listBuilds } from "../../src/storage/buildsRepo";

export default function BuildsScreen() {
  const router = useRouter();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await listBuilds();
    setBuilds(list);
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
          <View>
            <Text style={styles.metaLabel}>Portfolio</Text>
            <Text style={styles.title}>My Builds</Text>
          </View>
          <Pressable
            style={styles.closetBtn}
            onPress={() => router.push("/closet")}
          >
            <Ionicons name="cube-outline" size={14} color={colors.black} />
            <Text style={styles.closetBtnText}>Closet</Text>
          </Pressable>
        </View>

        {loading && <Text style={styles.meta}>Loading…</Text>}
        {!loading && builds.length === 0 && (
          <Text style={styles.meta}>
            No builds yet. Create one to link closet items and use them in
            convention packing.
          </Text>
        )}
        {builds.map((b) => (
          <Pressable
            key={b.id}
            style={styles.buildRow}
            onPress={() =>
              router.push({ pathname: "/build-detail", params: { id: b.id } })
            }
          >
            <Text style={styles.buildName}>{b.name}</Text>
            <Text style={styles.buildMeta}>{b.status}</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push("/build-new")}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
  closetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closetBtnText: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "bold",
    color: colors.black,
  },
  meta: {
    fontSize: 12,
    color: colors.meta,
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 24,
  },
  buildRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: layout.screenPaddingX,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  buildName: {
    flex: 1,
    fontFamily: font.serif,
    fontSize: 20,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
  },
  buildMeta: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  fab: {
    position: "absolute",
    bottom: 120,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
});
