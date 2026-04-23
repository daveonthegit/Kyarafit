import { useEffect, useLayoutEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_PRICING_MODES,
  type CosplayPricingMode,
} from "@kyarafit/design-system/types";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard, TextField } from "@/ui";

function dollarsFromCents(cents: number | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
}

function parseDollarsToCents(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(value)) return undefined;
  return Math.round(value * 100);
}

type Ready = {
  userId: string;
  nodeId: Id<"cosplayNodes">;
};

export default function ElementEditScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const nodeId = param ? (param as Id<"cosplayNodes">) : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("elements.editTitle") });
  }, [navigation, t]);

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const node = useQuery(api.cosplayNodes.get, nodeId ? { id: nodeId } : "skip");

  const loading = identity === undefined || (nodeId != null && node === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!nodeId || !userId || node === null) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && nodeId && userId ? { userId, nodeId } : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) =>
        node ? (
          <ElementEditForm loaded={loaded} node={node} onSaved={() => router.back()} t={t} />
        ) : null
      }
    </DataBoundary>
  );
}

function ElementEditForm({
  loaded,
  node,
  onSaved,
  t,
}: {
  loaded: Ready;
  node: Doc<"cosplayNodes">;
  onSaved: () => void;
  t: TFunction;
}) {
  const { colors } = useDesignTheme();
  const update = useMutation(api.cosplayNodes.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [seeded, setSeeded] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [pricingMode, setPricingMode] = useState<CosplayPricingMode>("total");
  const [directDollars, setDirectDollars] = useState("");
  const [unitCostDollars, setUnitCostDollars] = useState("");
  const [quantityStr, setQuantityStr] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!node || seeded) return;
    setName(node.name);
    setNotes(node.notes ?? "");
    setTagsRaw(node.tags?.length ? node.tags.join(", ") : "");
    setCategory(node.category ?? undefined);
    const mode = (node.pricingMode as CosplayPricingMode | undefined) ?? "total";
    setPricingMode(mode === "per_unit" ? "per_unit" : "total");
    setDirectDollars(dollarsFromCents(node.directCostCents));
    setUnitCostDollars(dollarsFromCents(node.unitCostCents));
    setQuantityStr(node.quantity != null ? String(node.quantity) : "");
    setUnitLabel(node.unit ?? "");
    setSeeded(true);
  }, [node, seeded]);

  const pickHero = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
    }
  };

  const onSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName || busy) return;
    setBusy(true);
    void (async () => {
      try {
        let imageStorageId: Id<"_storage"> | undefined;
        if (pickedUri) {
          const uploadUrl = await generateUploadUrl();
          imageStorageId = await uploadUriToConvexStorage(pickedUri, uploadUrl);
        }

        const tags = tagsRaw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

        const directCostCents =
          pricingMode === "total" ? (parseDollarsToCents(directDollars) ?? null) : null;
        const unitCostCents =
          pricingMode === "per_unit" ? (parseDollarsToCents(unitCostDollars) ?? null) : null;
        const quantityParsed = quantityStr.trim()
          ? Number.parseFloat(quantityStr.replace(",", "."))
          : null;
        const quantity =
          pricingMode === "per_unit" && quantityParsed != null && !Number.isNaN(quantityParsed)
            ? quantityParsed
            : null;

        await update({
          id: loaded.nodeId,
          userId: loaded.userId,
          name: trimmedName,
          notes: notes.trim() ? notes.trim() : null,
          tags,
          category: category ?? null,
          pricingMode,
          directCostCents,
          unitCostCents,
          quantity,
          unit: pricingMode === "per_unit" && unitLabel.trim() ? unitLabel.trim() : null,
          ...(imageStorageId ? { imageStorageId } : {}),
        });
        onSaved();
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <SectionHeading
          eyebrow={
            node.nodeType === "material" ? t("elements.typeMaterial") : t("elements.typeElement")
          }
          title={node.name}
        />
        <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("elements.newSubtitle")}
        </Text>
      </View>

      <SurfaceCard className="overflow-hidden">
        {pickedUri ? (
          <Image source={{ uri: pickedUri }} className="h-72 w-full" resizeMode="cover" />
        ) : node.imageStorageId || node.imageUrl ? (
          <ConvexStorageImage
            storageId={node.imageStorageId}
            imageUrl={node.imageUrl}
            className="h-72 w-full"
            accessibilityLabel={node.name}
          />
        ) : (
          <View className="h-64 items-center justify-center bg-kyar-panel dark:bg-kyar-dark-panel">
            <Text className="text-6xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
              {node.nodeType === "material" ? "◇" : "◆"}
            </Text>
          </View>
        )}

        <View className="px-5 py-5">
          <MetaLabel>{t("elements.heroLabel")}</MetaLabel>
          <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("elements.heroPick")}
          </Text>
          <Button
            title={t("elements.heroPick")}
            variant="secondary"
            onPress={() => void pickHero()}
            className="mt-4"
          />
        </View>
      </SurfaceCard>

      <SurfaceCard className="px-4 py-4">
        <MetaLabel>{t("elements.nameLabel")}</MetaLabel>
        <TextField
          className="mt-3"
          value={name}
          onChangeText={setName}
          placeholder={t("elements.namePlaceholder")}
          autoCapitalize="sentences"
        />

        <Text className="mt-5 text-sm font-medium text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("elements.notesLabel")}
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t("elements.notesPlaceholder")}
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
          className="mt-3 min-h-[120px] rounded-2xl border border-kyar-border bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-border dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
        />

        <MetaLabel className="mt-5">{t("elements.tagsLabel")}</MetaLabel>
        <TextField
          className="mt-3"
          value={tagsRaw}
          onChangeText={setTagsRaw}
          placeholder={t("elements.tagsPlaceholder")}
          autoCapitalize="none"
        />
      </SurfaceCard>

      <SurfaceCard className="px-4 py-4">
        <MetaLabel>{t("elements.categoryLabel")}</MetaLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <View className="flex-row gap-2">
            <ChoicePill
              active={category === undefined}
              label={t("elements.filterAll")}
              onPress={() => setCategory(undefined)}
            />
            {COSPLAY_CATEGORIES.map((value) => (
              <ChoicePill
                key={value}
                active={category === value}
                label={value}
                onPress={() => setCategory(value)}
              />
            ))}
          </View>
        </ScrollView>
      </SurfaceCard>

      <SurfaceCard className="px-4 py-4">
        <MetaLabel>{t("elements.pricingSection")}</MetaLabel>

        <View className="mt-4 flex-row rounded-full border border-kyar-borderSubtle bg-kyar-panel p-1 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
          {COSPLAY_PRICING_MODES.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setPricingMode(mode)}
              className={`flex-1 rounded-full px-4 py-3 ${
                pricingMode === mode ? "bg-kyar-text dark:bg-kyar-dark-text" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-center text-sm font-medium ${
                  pricingMode === mode
                    ? "text-kyar-bg dark:text-kyar-dark-bg"
                    : "text-kyar-text dark:text-kyar-dark-text"
                }`}
              >
                {mode === "total" ? t("elements.pricingTotal") : t("elements.pricingPerUnit")}
              </Text>
            </Pressable>
          ))}
        </View>

        {pricingMode === "total" ? (
          <TextField
            className="mt-4"
            label={t("elements.directCostLabel")}
            value={directDollars}
            onChangeText={setDirectDollars}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
        ) : (
          <>
            <TextField
              className="mt-4"
              label={t("elements.unitCostLabel")}
              value={unitCostDollars}
              onChangeText={setUnitCostDollars}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <TextField
              className="mt-4"
              label={t("elements.quantityLabel")}
              value={quantityStr}
              onChangeText={setQuantityStr}
              placeholder="1"
              keyboardType="decimal-pad"
            />
            <TextField
              className="mt-4"
              label={t("elements.unitLabel")}
              value={unitLabel}
              onChangeText={setUnitLabel}
              placeholder={t("elements.unitPlaceholder")}
              autoCapitalize="none"
            />
          </>
        )}
      </SurfaceCard>

      <View className="gap-3">
        <Button
          title={busy ? t("elements.saving") : t("common.save")}
          onPress={onSave}
          loading={busy}
          disabled={!name.trim()}
        />
        <Button title={t("elements.discardBack")} variant="secondary" onPress={onSaved} />
      </View>
    </ScrollView>
  );
}

function ChoicePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
