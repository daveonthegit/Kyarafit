import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { listConventions } from "../src/storage/conventionsRepo";
import { getPacking, toggleChecked } from "../src/storage/packingRepo";
import { ChecklistRow } from "../src/components/ui/ChecklistRow";
import { useCurrentUser } from "../src/hooks/useCurrentUser";

type ConventionRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
};

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

  const convexConventions = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const convexPacking = useQuery(
    api.conventions.getPacking,
    userId && selectedId ? { conventionId: selectedId as Id<"conventions"> } : "skip"
  );
  const updatePackingItem = useMutation(api.conventions.updatePackingItem);

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

  const general = items.filter((i) => !i.date && !i.buildId);
  const byDate = new Map<string, PackingRow[]>();
  for (const i of items.filter((i) => i.date || i.buildId)) {
    const key = i.date ?? "general";
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(i);
  }
  const dateKeys = Array.from(byDate.keys()).sort();

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row justify-between items-end px-6 pt-12 pb-4">
        <View>
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-1">
            Logistics
          </Text>
          <Text className="font-serif text-[28px] font-bold italic text-black tracking-tight leading-none">
            Packing List
          </Text>
        </View>
        {isCloud && (
          <Text className="text-[9px] uppercase tracking-[0.15em] font-semibold text-black/50">
            CLOUD SYNC ON
          </Text>
        )}
      </View>

      <View className="px-6 mb-6">
        <Text className="text-[8px] uppercase tracking-[0.2em] text-black/40 mb-2">CONVENTION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {conventions.map((c) => (
            <Pressable
              key={c.id}
              className={`py-2 px-3 border rounded-sm mr-3 ${selectedId === c.id ? "border-black bg-[#F9F9F9]" : "border-black/10"}`}
              onPress={() => setSelectedId(c.id)}
            >
              <Text
                className={`text-[10px] uppercase tracking-widest ${
                  selectedId === c.id ? "font-semibold text-black" : "text-black/40"
                }`}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}
      >
        {!selectedId && conventions.length === 0 && (
          <Text className="text-xs text-black/50 py-6">
            Create a convention and generate a packing list from the Events tab.
          </Text>
        )}
        {selectedId && !loading && items.length === 0 && (
          <Text className="text-xs text-black/50 py-6">
            No packing list yet. Generate one from the convention detail (Events tab).
          </Text>
        )}
        {loading && <Text className="text-xs text-black/50 py-6">Loading…</Text>}
        {selectedId && items.length > 0 && (
          <>
            {general.length > 0 && (
              <View className="mb-8">
                <Text className="font-serif text-lg font-bold italic text-black mb-4 border-b border-black pb-1.5">
                  GENERAL ESSENTIALS
                </Text>
                <View className="gap-1">
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
                <View key={key} className="mb-8">
                  <Text className="font-serif text-lg font-bold italic text-black mb-4 border-b border-black pb-1.5">
                    {heading}
                  </Text>
                  <View className="gap-1">
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
