import { useEffect, useLayoutEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
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
import { DataBoundary, TextField } from "@/ui";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";

function dollarsFromCents(cents: number | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
}

function parseDollarsToCents(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseFloat(t.replace(",", "."));
  if (Number.isNaN(n)) return undefined;
  return Math.round(n * 100);
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
    const n = name.trim();
    if (!n || busy) return;
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
          .map((x) => x.trim())
          .filter(Boolean);

        const directCostCents =
          pricingMode === "total" ? parseDollarsToCents(directDollars) ?? null : null;
        const unitCostCents =
          pricingMode === "per_unit" ? parseDollarsToCents(unitCostDollars) ?? null : null;
        const quantityParsed = quantityStr.trim()
          ? Number.parseFloat(quantityStr.replace(",", "."))
          : null;
        const quantity =
          pricingMode === "per_unit" &&
          quantityParsed != null &&
          !Number.isNaN(quantityParsed)
            ? quantityParsed
            : null;

        await update({
          id: loaded.nodeId,
          userId: loaded.userId,
          name: n,
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
    <ScrollView className="flex-1 bg-white px-4 pt-4" keyboardShouldPersistTaps="handled">
      <TextField
        label={t("elements.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("elements.namePlaceholder")}
        autoCapitalize="sentences"
      />

      <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {t("elements.notesLabel")}
      </Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={t("elements.notesPlaceholder")}
        multiline
        className="mt-2 min-h-[88px] rounded-xl border border-neutral-200 px-3 py-2.5 text-base text-neutral-900"
      />

      <TextField
        label={t("elements.tagsLabel")}
        value={tagsRaw}
        onChangeText={setTagsRaw}
        placeholder={t("elements.tagsPlaceholder")}
        autoCapitalize="none"
      />

      <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {t("elements.categoryLabel")}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        <Pressable
          onPress={() => setCategory(undefined)}
          className={`rounded-full border px-3 py-1.5 ${
            category === undefined ? "border-neutral-900 bg-neutral-900" : "border-neutral-200"
          }`}
        >
          <Text
            className={`text-xs font-medium ${category === undefined ? "text-white" : "text-neutral-800"}`}
          >
            {t("elements.filterAll")}
          </Text>
        </Pressable>
        {COSPLAY_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 ${
              category === c ? "border-neutral-900 bg-neutral-900" : "border-neutral-200"
            }`}
          >
            <Text
              className={`text-xs font-medium ${category === c ? "text-white" : "text-neutral-800"}`}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="mt-8 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {t("elements.pricingSection")}
      </Text>
      <View className="mt-2 flex-row gap-2">
        {COSPLAY_PRICING_MODES.map((m) => (
          <Pressable
            key={m}
            onPress={() => setPricingMode(m)}
            className={`flex-1 rounded-xl border px-3 py-3 ${
              pricingMode === m ? "border-neutral-900 bg-neutral-900" : "border-neutral-200"
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                pricingMode === m ? "text-white" : "text-neutral-800"
              }`}
            >
              {m === "total" ? t("elements.pricingTotal") : t("elements.pricingPerUnit")}
            </Text>
          </Pressable>
        ))}
      </View>

      {pricingMode === "total" ? (
        <TextField
          label={t("elements.directCostLabel")}
          value={directDollars}
          onChangeText={setDirectDollars}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      ) : (
        <>
          <TextField
            label={t("elements.unitCostLabel")}
            value={unitCostDollars}
            onChangeText={setUnitCostDollars}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <TextField
            label={t("elements.quantityLabel")}
            value={quantityStr}
            onChangeText={setQuantityStr}
            placeholder="1"
            keyboardType="decimal-pad"
          />
          <TextField
            label={t("elements.unitLabel")}
            value={unitLabel}
            onChangeText={setUnitLabel}
            placeholder={t("elements.unitPlaceholder")}
            autoCapitalize="none"
          />
        </>
      )}

      <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {t("elements.heroLabel")}
      </Text>
      <Pressable
        onPress={() => void pickHero()}
        className="mt-2 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-400 bg-neutral-50 py-8 active:opacity-90"
      >
        {pickedUri ? (
          <Image source={{ uri: pickedUri }} className="h-48 w-full" resizeMode="cover" />
        ) : (
          <Text className="text-neutral-500">{t("elements.heroPick")}</Text>
        )}
      </Pressable>

      <Pressable
        disabled={busy || !name.trim()}
        onPress={onSave}
        className={`mt-8 rounded-xl py-4 ${busy || !name.trim() ? "bg-neutral-300" : "bg-neutral-900"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {busy ? t("elements.saving") : t("common.save")}
        </Text>
      </Pressable>

      <Pressable onPress={() => onSaved()} className="mt-4 py-3">
        <Text className="text-center text-base text-neutral-600">{t("elements.discardBack")}</Text>
      </Pressable>

      <View className="h-8" />
    </ScrollView>
  );
}
