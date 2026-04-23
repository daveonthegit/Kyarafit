import { forwardRef, useCallback, useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import {
  ELEMENT_COMBINED_OPTIONS,
  MATERIAL_STATUS_OPTIONS,
  formatCents,
  statusChipInfo,
  type ElementCombinedStatus,
} from "@kyarafit/design-system/domain";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import type {
  DetailedNode,
  InspectorForm,
  NodeSelectionMeta,
  PersistStatus,
} from "./useNodeInspector";

type Props = {
  detail: DetailedNode | null | undefined;
  selected: NodeSelectionMeta | null;
  inspectorForm: InspectorForm;
  persistStatus: PersistStatus;
  onFormChange: (updater: (prev: InspectorForm) => InspectorForm) => void;
  onFlushSave: () => void;
  onCreateChild: (nodeType: "element" | "material") => void;
  onOpenDetail: () => void;
  onSelectChild: (childId: Id<"cosplayNodes">, index: number) => void;
  onUnlink: () => Promise<void> | void;
  onDismiss: () => void;
};

export type NodeDetailSheetRef = BottomSheetModal;

const TONE_DOT: Record<string, string> = {
  neutral: "bg-kyar-meta dark:bg-kyar-dark-meta",
  warning: "bg-amber-500",
  active: "bg-sky-500",
  success: "bg-emerald-500",
};

export const NodeDetailSheet = forwardRef<NodeDetailSheetRef, Props>(function NodeDetailSheet(
  {
    detail,
    selected,
    inspectorForm,
    persistStatus,
    onFormChange,
    onFlushSave,
    onCreateChild,
    onOpenDetail,
    onSelectChild,
    onUnlink,
    onDismiss,
  },
  ref
) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const snapPoints = useMemo(() => ["92%"], []);

  const handleUnlink = useCallback(() => {
    if (!detail) return;
    Alert.alert(
      t("elements.unlinkConfirmTitle"),
      detail.name,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.unlinkConfirmAction"),
          style: "destructive",
          onPress: () => {
            void onUnlink();
          },
        },
      ],
      { cancelable: true }
    );
  }, [detail, onUnlink, t]);

  const chip = detail ? statusChipInfo(detail) : null;
  const totalCost =
    detail?.totalCostCents != null && detail.totalCostCents > 0
      ? formatCents(detail.totalCostCents)
      : null;

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      onDismiss={onDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {detail && selected ? (
        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 pb-3 pt-1">
            <Text
              accessibilityLiveRegion="polite"
              className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta"
            >
              {persistStatus === "saving"
                ? t("elements.saving")
                : persistStatus === "dirty"
                  ? t("elements.unsaved", { defaultValue: "Unsaved" })
                  : persistStatus === "error"
                    ? t("elements.saveFailed", { defaultValue: "Save failed" })
                    : t("elements.saved", { defaultValue: "Saved" })}
            </Text>
          </View>

          <View className="flex-row items-start gap-3 px-5">
            <View className="h-14 w-14 overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
              {detail.imageStorageId || detail.imageUrl ? (
                <ConvexStorageImage
                  storageId={detail.imageStorageId}
                  imageUrl={detail.imageUrl}
                  className="h-full w-full"
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-2xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                    {detail.nodeType === "material" ? "◧" : "◇"}
                  </Text>
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1">
              <BottomSheetTextInput
                value={inspectorForm.name}
                onChangeText={(value) => onFormChange((prev) => ({ ...prev, name: value }))}
                onBlur={onFlushSave}
                placeholder={t("elements.namePlaceholder", { defaultValue: "Name" })}
                className="border-b border-transparent pb-1 text-xl text-kyar-text dark:text-kyar-dark-text"
                style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
              />
              <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                  {detail.nodeType === "material"
                    ? t("elements.typeMaterial", { defaultValue: "Material" })
                    : t("elements.typeElement", { defaultValue: "Element" })}
                </Text>
                {chip ? (
                  <View
                    className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[chip.tone] ?? TONE_DOT.neutral}`}
                  />
                ) : null}
                <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                  {detail.progressPercent ?? 0}%
                </Text>
              </View>
            </View>
          </View>

          <View className="px-5 pt-5">
            <Text className="mb-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {t("elements.statusLabel", { defaultValue: "Status" })}
            </Text>
            <View className="flex-row gap-1 rounded-2xl bg-kyar-panel p-1 dark:bg-kyar-dark-panel">
              {(detail.nodeType === "element"
                ? ELEMENT_COMBINED_OPTIONS
                : MATERIAL_STATUS_OPTIONS
              ).map((opt) => {
                const isActive =
                  detail.nodeType === "element"
                    ? inspectorForm.elementCombinedStatus === opt.value
                    : inspectorForm.materialStatus === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      if (detail.nodeType === "element") {
                        onFormChange((prev) => ({
                          ...prev,
                          elementCombinedStatus: opt.value as ElementCombinedStatus,
                        }));
                      } else {
                        onFormChange((prev) => ({ ...prev, materialStatus: opt.value }));
                      }
                    }}
                    className={`flex-1 items-center rounded-xl px-2 py-2 ${
                      isActive ? "bg-kyar-surface shadow-soft dark:bg-kyar-dark-surface" : ""
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-medium ${
                        isActive
                          ? "text-kyar-text dark:text-kyar-dark-text"
                          : "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="px-5 pt-5">
            <Text className="mb-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {t("elements.directCostLabel", { defaultValue: "Direct cost (USD)" })}
            </Text>
            <BottomSheetTextInput
              value={inspectorForm.directCostDollars}
              onChangeText={(value) =>
                onFormChange((prev) => ({ ...prev, directCostDollars: value }))
              }
              onBlur={onFlushSave}
              keyboardType="decimal-pad"
              placeholder="0.00"
              className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-3 py-2.5 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
            />
            {totalCost ? (
              <Text className="mt-1 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.rollupCost", { defaultValue: "Rollup" })}: {totalCost}
              </Text>
            ) : null}
          </View>

          <View className="px-5 pt-5">
            <Text className="mb-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {t("elements.notesLabel", { defaultValue: "Notes" })}
            </Text>
            <BottomSheetTextInput
              value={inspectorForm.notes}
              onChangeText={(value) => onFormChange((prev) => ({ ...prev, notes: value }))}
              onBlur={onFlushSave}
              multiline
              placeholder={t("elements.notesPlaceholder", { defaultValue: "Add notes…" })}
              className="min-h-[96px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-3 py-2.5 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
            />
          </View>

          {detail.children && detail.children.length > 0 ? (
            <View className="px-5 pt-6">
              <Text className="mb-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.childrenLabel", { defaultValue: "Children" })} ·{" "}
                {detail.children.length}
              </Text>
              <View className="gap-1.5">
                {detail.children.map((child, index) => (
                  <Pressable
                    key={child._id as string}
                    onPress={() => onSelectChild(child._id, index)}
                    className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                    accessibilityRole="button"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="min-w-0 flex-1">
                        <Text
                          style={{ fontFamily: APP_FONT_FAMILIES.sansSemiBold }}
                          className="text-sm text-kyar-text dark:text-kyar-dark-text"
                        >
                          {child.name}
                        </Text>
                        <Text className="text-[10px] uppercase tracking-wider text-kyar-meta dark:text-kyar-dark-meta">
                          {child.nodeType === "material"
                            ? t("elements.typeMaterial", { defaultValue: "Material" })
                            : t("elements.typeElement", { defaultValue: "Element" })}
                        </Text>
                      </View>
                      <Text className="text-base text-kyar-meta dark:text-kyar-dark-meta">›</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View className="mt-8 px-5">
            <View className="mb-3 flex-row gap-3">
              <Pressable
                onPress={() => onCreateChild("element")}
                className="flex-1 items-center rounded-2xl border border-kyar-borderSubtle bg-kyar-surface py-3 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                accessibilityRole="button"
              >
                <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("buildDetail.addChildElement", { defaultValue: "Child element" })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onCreateChild("material")}
                className="flex-1 items-center rounded-2xl border border-kyar-borderSubtle bg-kyar-surface py-3 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                accessibilityRole="button"
              >
                <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("buildDetail.addChildMaterial", { defaultValue: "Child material" })}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={onOpenDetail}
              className="mb-3 items-center rounded-2xl border border-kyar-borderSubtle bg-kyar-panel py-3 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
              accessibilityRole="button"
            >
              <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
                {t("buildDetail.openElement", { defaultValue: "Open full element" })}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleUnlink}
              className="items-center rounded-2xl border border-kyar-danger/35 bg-kyar-surface py-3 active:opacity-80 dark:bg-kyar-dark-surface"
              accessibilityRole="button"
            >
              <Text className="font-semibold text-kyar-danger dark:text-kyar-dark-danger">
                {selected.isRoot
                  ? t("buildDetail.removeFromBuild", { defaultValue: "Remove from build" })
                  : t("elements.unlinkChild", { defaultValue: "Unlink child" })}
              </Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      ) : (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-kyar-meta dark:text-kyar-dark-meta">
            {t("common.loading", { defaultValue: "Loading…" })}
          </Text>
        </View>
      )}
    </BottomSheetModal>
  );
});
