import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { listBuilds } from "../../src/storage/buildsRepo";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";

type TabFilter = "all" | "current" | "archived" | "planning" | "completed";

/** Minimal build shape for rendering — avoids coupling to Go-era design-system types */
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

  // Cloud data (Convex) — used when signed in
  const convexBuilds = useQuery(api.builds.list, userId ? { userId } : "skip");

  // Local data (SQLite) — used when anonymous
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.metaLabel}>Portfolio</Text>
            <Text style={styles.title}>My Builds</Text>
          </View>
          <Pressable style={styles.closetBtn} onPress={() => router.push("/closet")}>
            <Ionicons name="cube-outline" size={14} color={colors.black} />
            <Text style={styles.closetBtnText}>Closet</Text>
          </Pressable>
        </View>

        {/* Status tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {(["all", "current", "planning", "completed", "archived"] as TabFilter[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading && <Text style={styles.meta}>Loading…</Text>}
        {!loading && rawBuilds.length === 0 && (
          <Text style={styles.meta}>
            No builds yet. Create one to link closet items and use them in convention packing.
          </Text>
        )}
        {!loading && filteredBuilds.length === 0 && rawBuilds.length > 0 && (
          <Text style={styles.meta}>No builds in this category.</Text>
        )}
        {filteredBuilds.map((b, index) => {
          const projectNumber = String(index + 1).padStart(3, "0");
          const progress = b.tasksTotal > 0 ? Math.round((b.tasksChecked / b.tasksTotal) * 100) : 0;

          return (
            <View key={b.id} style={styles.card}>
              <Pressable
                onPress={() => router.push({ pathname: "/build-detail", params: { id: b.id } })}
              >
                {b.imageUrl ? (
                  <Image source={{ uri: b.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
                  </View>
                )}
              </Pressable>

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{b.name}</Text>
                  <Text style={styles.cardProject}>PROJECT {projectNumber}</Text>
                </View>

                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>CONSTRUCTION PROGRESS</Text>
                    <Text style={styles.progressPercent}>{progress}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.cardTags}>
                    <Text style={styles.cardTag}>{b.status}</Text>
                    {b.character && <Text style={styles.cardTag}>{b.character}</Text>}
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/build-detail", params: { id: b.id } })}
                  >
                    <Text style={styles.viewDetails}>View Details</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
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
  scrollContent: { paddingBottom: 140, paddingTop: 16 },
  header: {
    backgroundColor: colors.white,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: layout.screenPaddingX,
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
  tabsScroll: {
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 24,
  },
  tabActive: {
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
  },
  tabText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.textTertiary,
  },
  tabTextActive: {
    fontWeight: "600",
    color: colors.black,
  },
  meta: {
    fontSize: 12,
    color: colors.meta,
    paddingHorizontal: layout.screenPaddingX,
    paddingVertical: 24,
  },
  card: {
    marginBottom: 48,
    paddingHorizontal: layout.screenPaddingX,
  },
  cardImage: {
    width: "100%",
    aspectRatio: 2 / 3,
    backgroundColor: colors.muted,
    marginBottom: 16,
  },
  cardImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    gap: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  cardTitle: {
    fontFamily: font.serif,
    fontSize: 24,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    letterSpacing: -0.5,
    flex: 1,
  },
  cardProject: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textTertiary,
    fontWeight: "500",
  },
  progressSection: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  progressLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "500",
    color: colors.textTertiary,
  },
  progressPercent: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "500",
    color: colors.textTertiary,
  },
  progressBarBg: {
    height: 1,
    backgroundColor: "#eeeeee",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.black,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  cardTags: {
    flexDirection: "row",
    gap: 16,
  },
  cardTag: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.textTertiary,
  },
  viewDetails: {
    fontSize: 11,
    fontWeight: "500",
    textDecorationLine: "underline",
    color: colors.black,
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
