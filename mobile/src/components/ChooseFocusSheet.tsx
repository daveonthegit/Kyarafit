import { useCallback, useMemo, useState, type ComponentRef, type RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";

type ChooseFocusSheetRef = ComponentRef<typeof BottomSheetModal>;

export type FocusPickerBuild = {
  _id: Id<"builds">;
  name: string;
  character?: string;
  tasksChecked: number;
  tasksTotal: number;
};

type Props = {
  sheetRef: RefObject<ChooseFocusSheetRef | null>;
  builds: FocusPickerBuild[];
  /** `null` means “use most recent” (no pinned focus). */
  focusedBuildId: Id<"builds"> | null;
  onSelectMostRecent: () => void;
  onSelectBuild: (id: Id<"builds">) => void;
};

export function ChooseFocusSheet({
  sheetRef,
  builds,
  focusedBuildId,
  onSelectMostRecent,
  onSelectBuild,
}: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const snapPoints = useMemo(() => ["50%", "88%"], []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return builds;
    return builds.filter(
      (b) =>
        b.name.toLowerCase().includes(s) || (b.character ?? "").toLowerCase().includes(s)
    );
  }, [builds, q]);

  const renderItem = useCallback(
    ({ item }: { item: FocusPickerBuild }) => {
      const selected = focusedBuildId === item._id;
      return (
        <Pressable
          onPress={() => onSelectBuild(item._id)}
          className="border-b border-neutral-200 px-4 py-3 active:bg-neutral-100"
          accessibilityRole="button"
          accessibilityState={{ selected }}
        >
          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Text className="font-semibold text-neutral-900">{item.name}</Text>
              <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
                {t("home.itemsComplete", {
                  checked: item.tasksChecked,
                  total: item.tasksTotal,
                })}
                {item.character ? ` · ${item.character}` : ""}
              </Text>
            </View>
            {selected ? (
              <Text className="shrink-0 text-base text-neutral-900" accessibilityLabel={t("home.focusSelected")}>
                ✓
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [focusedBuildId, onSelectBuild, t]
  );

  const keyExtractor = useCallback((item: FocusPickerBuild) => item._id, []);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={() => setQ("")}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View className="border-b border-neutral-200 px-4 pb-3 pt-1">
        <Text className="text-lg font-semibold text-neutral-900">{t("home.selectFocus")}</Text>
        <BottomSheetTextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("home.searchBuildsFocus")}
          placeholderTextColor="#a3a3a3"
          className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base text-neutral-900"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <Pressable
        onPress={onSelectMostRecent}
        className="border-b border-neutral-200 px-4 py-3 active:bg-neutral-100"
        accessibilityRole="button"
        accessibilityState={{ selected: focusedBuildId === null }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-base text-neutral-900">{t("home.defaultFocus")}</Text>
          {focusedBuildId === null ? (
            <Text className="text-base text-neutral-900" accessibilityLabel={t("home.focusSelected")}>
              ✓
            </Text>
          ) : null}
        </View>
      </Pressable>
      <BottomSheetFlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text className="px-4 py-8 text-center text-neutral-500">{t("home.noBuildsMatch")}</Text>
        }
      />
    </BottomSheetModal>
  );
}
