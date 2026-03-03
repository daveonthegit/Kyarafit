import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import { listConventions } from "../../src/storage/conventionsRepo";
import { getPacking, toggleChecked } from "../../src/storage/packingRepo";
import { ChecklistRow } from "../../src/components/ui/ChecklistRow";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";

/** Minimal convention shape for rendering */
type ConventionRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
};

/** Minimal packing item shape for rendering */
type PackingRow = {
  id: string;
  conventionId: string;
  label: string;
  checked: boolean;
  date?: string;
  buildId?: string;
  closetItemId?: string;
};

export default function PackingScreen() {
  const params = useLocalSearchParams<{ conventionId?: string }>();
  const { userId } = useCurrentUser();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (params.conventionId) setSelectedId(params.conventionId);
  }, [params.conventionId]);

  // ─── Cloud path (Convex) ───────────────────────────────────────────────────
  const convexConventions = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const convexPacking = useQuery(
    api.conventions.getPacking,
    userId && selectedId ? { conventionId: selectedId as Id<"conventions"> } : "skip"
  );
  const updatePackingItem = useMutation(api.conventions.updatePackingItem);

  // ─── Local path (SQLite) ───────────────────────────────────────────────────
  const [localConventions, setLocalConventions] = useState<ConventionRow[]>([]);
  const [localItems, setLocalItems] = useState<PackingRow[]>([]);
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
          if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
        });
      }
    }, [userId, selectedId])
  );

  useEffect(() => {
    if (!userId && selectedId) {
      getPacking(selectedId).then((list) => {
        setLocalItems(
          list.map((p) => ({
            id: p.id,
            conventionId: p.conventionId,
            label: p.label,
            checked: p.checked,
            date: p.date ?? undefined,
            buildId: p.buildId ?? undefined,
            closetItemId: p.closetItemId ?? undefined,
          }))
        );
      });
    }
  }, [userId, selectedId]);

  // ─── Unified data ──────────────────────────────────────────────────────────
  const isCloud = !!userId;

  const conventions: ConventionRow[] = isCloud
    ? (convexConventions ?? []).map((c) => ({
        id: c._id as string,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        location: c.location,
      }))
    : localConventions;

  const items: PackingRow[] = isCloud
    ? (convexPacking ?? []).map((p) => ({
        id: p._id as string,
        conventionId: p.conventionId as string,
        label: p.label,
        checked: p.checked,
        date: p.date,
        buildId: p.buildId as string | undefined,
        closetItemId: p.closetItemId as string | undefined,
      }))
    : localItems;

  const loading = isCloud
    ? convexConventions === undefined || (!!selectedId && convexPacking === undefined)
    : localLoading;

  // Auto-select first convention when list loads
  useEffect(() => {
    if (conventions.length > 0 && !selectedId) {
      setSelectedId(conventions[0].id);
    }
  }, [conventions, selectedId]);

  const handleToggle = useCallback(
    async (item: PackingRow) => {
      if (isCloud && userId) {
        await updatePackingItem({
          id: item.id as Id<"packingListItems">,
          userId,
          checked: !item.checked,
        });
      } else {
        const updated = await toggleChecked(item.id);
        if (updated) {
          setLocalItems((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, checked: updated.checked } : p))
          );
        }
      }
    },
    [isCloud, userId, updatePackingItem]
  );

  // Group items: General (no date/build), then by date
  const general = items.filter((i) => !i.date && !i.buildId);
  const byDate = new Map<string, PackingRow[]>();
  for (const i of items.filter((i) => i.date || i.buildId)) {
    const key = i.date ?? "general";
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(i);
  }
  const dateKeys = Array.from(byDate.keys()).sort();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.metaLabel}>Logistics</Text>
          <Text style={styles.title}>Packing List</Text>
        </View>
        {isCloud && <Text style={styles.syncLabel}>CLOUD SYNC ON</Text>}
      </View>

      <View style={styles.selectorRow}>
        <Text style={styles.selectorLabel}>CONVENTION</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorScroll}
        >
          {conventions.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.selectorBtn, selectedId === c.id && styles.selectorBtnActive]}
              onPress={() => setSelectedId(c.id)}
            >
              <Text
                style={[
                  styles.selectorBtnText,
                  selectedId === c.id && styles.selectorBtnTextActive,
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!selectedId && conventions.length === 0 && (
          <Text style={styles.meta}>
            Create a convention and generate a packing list from the Plan tab.
          </Text>
        )}
        {selectedId && !loading && items.length === 0 && (
          <Text style={styles.meta}>
            No packing list yet. Generate one from the convention detail (Plan tab).
          </Text>
        )}
        {loading && <Text style={styles.meta}>Loading…</Text>}
        {selectedId && items.length > 0 && (
          <>
            {general.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>GENERAL ESSENTIALS</Text>
                <View style={styles.checkList}>
                  {general.map((item) => (
                    <ChecklistRow
                      key={item.id}
                      label={item.label}
                      checked={item.checked}
                      onToggle={() => handleToggle(item)}
                    />
                  ))}
                </View>
              </View>
            )}
            {dateKeys.map((key) => {
              const list = byDate.get(key)!;
              const first = list[0];
              const heading = first?.date ?? key;
              return (
                <View key={key} style={styles.section}>
                  <Text style={styles.sectionTitle}>{heading}</Text>
                  <View style={styles.checkList}>
                    {list.map((item) => (
                      <ChecklistRow
                        key={item.id}
                        label={item.label}
                        checked={item.checked}
                        onToggle={() => handleToggle(item)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 48,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  selectorRow: { paddingHorizontal: layout.screenPaddingX, marginBottom: 24 },
  selectorLabel: {
    fontSize: 8,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textTertiary,
    marginBottom: 8,
  },
  selectorScroll: { flexDirection: "row", gap: 12 },
  selectorBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorBtnActive: {
    borderColor: colors.black,
    backgroundColor: colors.muted,
  },
  selectorBtnText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  selectorBtnTextActive: { color: colors.black, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: 140,
  },
  meta: { fontSize: 12, color: colors.meta, paddingVertical: 24 },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontFamily: font.serif,
    fontSize: 18,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.black,
    paddingBottom: 6,
  },
  checkList: { gap: 4 },
});
