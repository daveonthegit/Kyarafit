import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import type { ClosetItem } from "@kyarafit/design-system/types";
import { listItems } from "../src/storage/closetRepo";
import {
  getLinkedClosetItemIds,
  linkBuildItems,
} from "../src/storage/buildsRepo";

export default function BuildLinkItemsScreen() {
  const { buildId } = useLocalSearchParams<{ buildId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!buildId) return;
    listItems().then(setItems);
    getLinkedClosetItemIds(buildId).then((ids) => setSelectedIds(new Set(ids)));
  }, [buildId]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!buildId) return;
    setSaving(true);
    try {
      await linkBuildItems(buildId, Array.from(selectedIds));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>CANCEL</Text>
        </Pressable>
        <Text style={styles.metaLabel}>Link Closet Items</Text>
        <Pressable onPress={save} disabled={saving}>
          <Text style={styles.saveText}>SAVE</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.hint}>
          Select items to include in this build. They will appear in packing
          lists when this build is assigned to a day.
        </Text>
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() => toggle(item.id)}
          >
            <View
              style={[
                styles.checkbox,
                selectedIds.has(item.id) && styles.checkboxChecked,
              ]}
            >
              {selectedIds.has(item.id) && <View style={styles.checkmark} />}
            </View>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemCategory}>{item.category}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.meta,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  saveText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.black,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: layout.screenPaddingX, paddingBottom: 48 },
  hint: { fontSize: 12, color: colors.textTertiary, marginBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.black },
  checkmark: { width: 6, height: 6, backgroundColor: colors.white },
  itemName: { flex: 1, fontSize: 14, color: colors.text },
  itemCategory: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
});
