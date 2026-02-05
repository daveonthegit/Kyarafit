import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type {
  Convention,
  PackingListItem,
} from "@kyarafit/design-system/types";
import { listConventions } from "../../src/storage/conventionsRepo";
import { getPacking, toggleChecked } from "../../src/storage/packingRepo";
import { getSyncPendingCount } from "../../src/services/sync";
import { ChecklistRow } from "../../src/components/ui/ChecklistRow";

export default function PackingScreen() {
  const params = useLocalSearchParams<{ conventionId?: string }>();
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<PackingListItem[]>([]);
  const [syncPending, setSyncPending] = useState(0);

  useEffect(() => {
    if (params.conventionId) setSelectedId(params.conventionId);
  }, [params.conventionId]);

  const load = useCallback(async () => {
    const [list, pending] = await Promise.all([
      listConventions(),
      getSyncPendingCount(),
    ]);
    setConventions(list);
    setSyncPending(pending);
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
  }, [selectedId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    getPacking(selectedId).then(setItems);
  }, [selectedId]);

  const handleToggle = useCallback(async (item: PackingListItem) => {
    const updated = await toggleChecked(item.id);
    if (updated)
      setItems((prev) => prev.map((p) => (p.id === item.id ? updated : p)));
  }, []);

  const convention = conventions.find((c) => c.id === selectedId);

  // Group items: General (no date), then by date/build
  const general = items.filter((i) => !i.date && !i.buildId);
  const byDate = new Map<string, PackingListItem[]>();
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
        {syncPending > 0 && <Text style={styles.syncLabel}>SYNC PENDING</Text>}
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
              style={[
                styles.selectorBtn,
                selectedId === c.id && styles.selectorBtnActive,
              ]}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {!selectedId && conventions.length === 0 && (
          <Text style={styles.meta}>
            Create a convention and generate a packing list from the Plan tab.
          </Text>
        )}
        {selectedId && items.length === 0 && (
          <Text style={styles.meta}>
            No packing list yet. Generate one from the convention detail (Plan
            tab).
          </Text>
        )}
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
