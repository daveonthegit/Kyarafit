import { forwardRef, useCallback, useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import {
  ELEMENT_COMBINED_OPTIONS,
  MATERIAL_STATUS_OPTIONS,
  formatCents,
  statusChipInfo,
  type ElementCombinedStatus,
} from "@kyarafit/design-system/domain";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
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
  onUnlink: () => Promise<void> | void;
  onDismiss: () => void;
};

export type NodeDetailSheetRef = BottomSheetModal;

const TONE_DOT: Record<string, string> = {
  neutral: "bg-neutral-400",
  warning: "bg-amber-500",
  active: "bg-sky-500",
  success: "bg-emerald-500",
};

export const NodeDetailSheet = forwardRef<NodeDetailSheetRef, Props>(function NodeDetailSheet(
  { detail, selected, inspectorForm, persistStatus, onFormChange, onFlushSave, onUnlink, onDismiss },
  ref
) {
  const { t } = useTranslation();
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
              className="text-[10px] uppercase tracking-widest text-neutral-500"
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
            <View className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              {detail.imageStorageId || detail.imageUrl ? (
                <ConvexStorageImage
                  storageId={detail.imageStorageId}
                  imageUrl={detail.imageUrl}
                  className="h-full w-full"
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-2xl text-neutral-300">
                    {detail.nodeType === "material" ? "◧" : "◇"}
                  </Text>
                </View>
              )}
            </View>
            <View className="min-w-0 flex-1">
              <BottomSheetTextInput
                value={inspectorForm.name}
                onChangeText={(value) =>
                  onFormChange((prev) => ({ ...prev, name: value }))
                }
                onBlur={onFlushSave}
                placeholder={t("elements.namePlaceholder", { defaultValue: "Name" })}
                className="border-b border-transparent pb-1 text-xl font-semibold text-neutral-900"
              />
              <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
                <Text className="text-[10px] uppercase tracking-widest text-neutral-500">
                  {detail.nodeType === "material"
                    ? t("elements.typeMaterial", { defaultValue: "Material" })
                    : t("elements.typeElement", { defaultValue: "Element" })}
                </Text>
                {chip ? (
                  <View
                    className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[chip.tone] ?? TONE_DOT.neutral}`}
                  />
                ) : null}
                <Text className="text-[10px] uppercase tracking-widest text-neutral-500">
                  {detail.progressPercent ?? 0}%
                </Text>
              </View>
            </View>
          </View>

          <View className="px-5 pt-5">
            <Text className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
              {t("elements.statusLabel", { defaultValue: "Status" })}
            </Text>
            <View className="flex-row gap-1 rounded-xl bg-neutral-100 p-1">
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
                    className={`flex-1 items-center rounded-lg px-2 py-2 ${
                      isActive ? "bg-white shadow-sm" : ""
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-medium ${
                        isActive ? "text-neutral-900" : "text-neutral-600"
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
            <Text className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
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
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base text-neutral-900"
            />
            {totalCost ? (
              <Text className="mt-1 text-xs text-neutral-500">
                {t("elements.rollupCost", { defaultValue: "Rollup" })}: {totalCost}
              </Text>
            ) : null}
          </View>

          <View className="px-5 pt-5">
            <Text className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
              {t("elements.notesLabel", { defaultValue: "Notes" })}
            </Text>
            <BottomSheetTextInput
              value={inspectorForm.notes}
              onChangeText={(value) =>
                onFormChange((prev) => ({ ...prev, notes: value }))
              }
              onBlur={onFlushSave}
              multiline
              placeholder={t("elements.notesPlaceholder", { defaultValue: "Add notes…" })}
              className="min-h-[96px] rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base text-neutral-900"
            />
          </View>

          {detail.children && detail.children.length > 0 ? (
            <View className="px-5 pt-6">
              <Text className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
                {t("elements.childrenLabel", { defaultValue: "Children" })} · {detail.children.length}
              </Text>
              <View className="gap-1.5">
                {detail.children.map((child) => (
                  <View
                    key={child._id as string}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
                  >
                    <Text className="text-sm font-medium text-neutral-900">{child.name}</Text>
                    <Text className="text-[10px] uppercase tracking-wider text-neutral-500">
                      {child.nodeType === "material"
                        ? t("elements.typeMaterial", { defaultValue: "Material" })
                        : t("elements.typeElement", { defaultValue: "Element" })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className="mt-8 px-5">
            <Pressable
              onPress={handleUnlink}
              className="items-center rounded-xl border border-red-200 bg-red-50 py-3 active:opacity-80"
              accessibilityRole="button"
            >
              <Text className="font-semibold text-red-700">
                {selected.isRoot
                  ? t("buildDetail.removeFromBuild", { defaultValue: "Remove from build" })
                  : t("elements.unlinkChild", { defaultValue: "Unlink child" })}
              </Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      ) : (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-neutral-500">{t("common.loading", { defaultValue: "Loading…" })}</Text>
        </View>
      )}
    </BottomSheetModal>
  );
});
