import { forwardRef, useCallback, useMemo } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import {
  ELEMENT_COMBINED_OPTIONS,
  MATERIAL_STATUS_OPTIONS,
  formatCents,
  statusChipInfo,
  type ElementCombinedStatus,
} from "@kyarafit/design-system/domain";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { glassChipColors } from "@/ui/glass";
import { GlassMeta, GlassOutlineButton, GlassSolidButton } from "./glassAtoms";
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

/**
 * 8b element inspector — overlay-weight glass over the build photo.
 * @gorhom/bottom-sheet cannot host expo-blur behind its own pan-responder
 * background, so the sheet uses the opaque overlay fallback color instead of
 * live blur (allowed per Glass Studio brief).
 */
const FIELD_STYLE = {
  minHeight: 44,
  borderWidth: 1,
  borderColor: glass.border.overlay,
  borderRadius: 10,
  backgroundColor: glass.surface.field,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontFamily: APP_FONT_FAMILIES.sansRegular,
  fontSize: 15,
  color: glass.text.fg,
} as const;

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
  const snapPoints = useMemo(() => ["55%", "92%"], []);

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
  const nameMissing = !inspectorForm.name.trim();

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{
        backgroundColor: glass.fallback.overlay,
        borderTopLeftRadius: glass.radius.sheet,
        borderTopRightRadius: glass.radius.sheet,
        borderWidth: borderWidth.hairline,
        borderColor: glass.border.overlay,
      }}
      handleIndicatorStyle={{ backgroundColor: glass.border.strong, width: 44 }}
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
          <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
            <GlassMeta size={9} tone={persistStatus === "error" ? "danger" : "fg55"} tracking={0.2}>
              <Text accessibilityLiveRegion="polite">
                {persistStatus === "saving"
                  ? t("elements.saving")
                  : persistStatus === "dirty"
                    ? t("elements.unsaved", { defaultValue: "Unsaved" })
                    : persistStatus === "error"
                      ? t("elements.saveFailed", { defaultValue: "Save failed" })
                      : t("elements.saved", { defaultValue: "Saved" })}
              </Text>
            </GlassMeta>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              paddingHorizontal: 20,
            }}
          >
            <View
              style={{
                height: 56,
                width: 56,
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: borderWidth.hairline,
                borderColor: glass.border.default,
                backgroundColor: glass.surface.field,
              }}
            >
              {detail.imageStorageId || detail.imageUrl ? (
                <ConvexStorageImage
                  storageId={detail.imageStorageId}
                  imageUrl={detail.imageUrl}
                  className="h-full w-full"
                />
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons
                    name={detail.nodeType === "material" ? "cube-outline" : "diamond-outline"}
                    size={20}
                    color={glass.text.fg55}
                  />
                </View>
              )}
            </View>

            <View style={{ minWidth: 0, flex: 1 }}>
              <BottomSheetTextInput
                value={inspectorForm.name}
                onChangeText={(value) => onFormChange((prev) => ({ ...prev, name: value }))}
                onBlur={onFlushSave}
                placeholder={t("elements.namePlaceholder", { defaultValue: "Name" })}
                placeholderTextColor={glass.text.fg45}
                keyboardAppearance="dark"
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontStyle: "italic",
                  fontSize: 24,
                  paddingBottom: 6,
                  color: glass.text.fg,
                  borderBottomWidth: 1,
                  borderBottomColor: nameMissing ? glass.text.danger : glass.border.dividerStrong,
                }}
              />
              {nameMissing ? (
                <GlassMeta size={9} tone="danger" style={{ marginTop: 4 }}>
                  {t("elements.nameRequired", { defaultValue: "Name is required" })}
                </GlassMeta>
              ) : null}
              <View
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GlassMeta size={9} tone="fg55">
                  {detail.nodeType === "material"
                    ? t("elements.typeMaterial", { defaultValue: "Material" })
                    : t("elements.typeElement", { defaultValue: "Element" })}
                </GlassMeta>
                {chip ? (
                  <View
                    style={{
                      height: 6,
                      width: 6,
                      borderRadius: 3,
                      backgroundColor: glassChipColors(chip.tone).fg,
                    }}
                  />
                ) : null}
                <GlassMeta size={9} tone="fg55">
                  {`${detail.progressPercent ?? 0}%`}
                </GlassMeta>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <GlassMeta size={10} tone="fg70" bold style={{ marginBottom: 8 }}>
              {t("elements.statusLabel", { defaultValue: "Status" })}
            </GlassMeta>
            <View
              style={{
                flexDirection: "row",
                gap: 4,
                borderRadius: 999,
                backgroundColor: glass.surface.bar,
                padding: 4,
              }}
            >
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
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 999,
                      paddingHorizontal: 6,
                      paddingVertical: 9,
                      backgroundColor: isActive ? glass.surface.solid : "transparent",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: isActive
                          ? APP_FONT_FAMILIES.sansSemiBold
                          : APP_FONT_FAMILIES.sansMedium,
                        fontSize: 11,
                        color: isActive ? glass.text.ink : glass.text.fg70,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <GlassMeta size={10} tone="fg70" bold style={{ marginBottom: 8 }}>
              {t("elements.directCostLabel", { defaultValue: "Direct cost (USD)" })}
            </GlassMeta>
            <BottomSheetTextInput
              value={inspectorForm.directCostDollars}
              onChangeText={(value) =>
                onFormChange((prev) => ({ ...prev, directCostDollars: value }))
              }
              onBlur={onFlushSave}
              keyboardType="decimal-pad"
              keyboardAppearance="dark"
              placeholder="0.00"
              placeholderTextColor={glass.text.fg45}
              style={FIELD_STYLE}
            />
            {totalCost ? (
              <GlassMeta size={9} tone="fg55" style={{ marginTop: 6 }}>
                {`${t("elements.rollupCost", { defaultValue: "Rollup" })}: ${totalCost}`}
              </GlassMeta>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <GlassMeta size={10} tone="fg70" bold style={{ marginBottom: 8 }}>
              {t("elements.notesLabel", { defaultValue: "Notes" })}
            </GlassMeta>
            <BottomSheetTextInput
              value={inspectorForm.notes}
              onChangeText={(value) => onFormChange((prev) => ({ ...prev, notes: value }))}
              onBlur={onFlushSave}
              multiline
              keyboardAppearance="dark"
              placeholder={t("elements.notesPlaceholder", { defaultValue: "Add notes…" })}
              placeholderTextColor={glass.text.fg45}
              style={[FIELD_STYLE, { minHeight: 96, textAlignVertical: "top" }]}
            />
          </View>

          {detail.children && detail.children.length > 0 ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
              <GlassMeta size={10} tone="fg70" bold style={{ marginBottom: 8 }}>
                {`${t("elements.childrenLabel", { defaultValue: "Children" })} · ${detail.children.length}`}
              </GlassMeta>
              <View style={{ gap: 6 }}>
                {detail.children.map((child, index) => (
                  <Pressable
                    key={child._id as string}
                    onPress={() => onSelectChild(child._id, index)}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      borderRadius: 10,
                      borderWidth: borderWidth.hairline,
                      borderColor: glass.border.divider,
                      backgroundColor: glass.surface.field,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                    accessibilityRole="button"
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ minWidth: 0, flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: APP_FONT_FAMILIES.sansMedium,
                            fontSize: 13,
                            color: glass.text.fg,
                          }}
                        >
                          {child.name}
                        </Text>
                        <GlassMeta size={9} tone="fg55" style={{ marginTop: 2 }}>
                          {child.nodeType === "material"
                            ? t("elements.typeMaterial", { defaultValue: "Material" })
                            : t("elements.typeElement", { defaultValue: "Element" })}
                        </GlassMeta>
                      </View>
                      <Text style={{ fontSize: 15, color: glass.text.fg55 }}>›</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <GlassSolidButton
              label={t("buildDetail.addChildElement", { defaultValue: "Child element" })}
              onPress={() => onCreateChild("element")}
              style={{ marginBottom: 10 }}
            />
            <GlassOutlineButton
              label={t("buildDetail.addChildMaterial", { defaultValue: "Child material" })}
              onPress={() => onCreateChild("material")}
              style={{ marginBottom: 10 }}
            />
            <GlassOutlineButton
              label={
                selected.isRoot
                  ? t("buildDetail.removeFromBuild", { defaultValue: "Remove from build" })
                  : t("elements.unlinkChild", { defaultValue: "Unlink child" })
              }
              danger
              onPress={handleUnlink}
              style={{ marginBottom: 14 }}
            />
            <Pressable
              onPress={onOpenDetail}
              accessibilityRole="button"
              style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.sansBold,
                  fontSize: 10,
                  letterSpacing: ls(0.18, 10),
                  textTransform: "uppercase",
                  textDecorationLine: "underline",
                  color: glass.text.fg70,
                }}
              >
                {t("buildDetail.openElement", { defaultValue: "Open full element" })}
              </Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 13,
              color: glass.text.fg55,
            }}
          >
            {t("common.loading", { defaultValue: "Loading…" })}
          </Text>
        </View>
      )}
    </BottomSheetModal>
  );
});
