import { useCallback, useLayoutEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_NODE_TYPES,
  type CosplayCategory,
  type CosplayNodeType,
} from "@kyarafit/design-system/types";
import type { TFunction } from "i18next";
import { DataBoundary, MetaLabel, Button, TextField } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";

export default function NewElementScreen() {
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const loading = identity === undefined;
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId) status = "empty";
  else status = "ready";

  type Ready = { userId: string };
  const data: Ready | undefined = status === "ready" && userId ? { userId } : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => <NewElementForm userId={loaded.userId} t={t} />}
    </DataBoundary>
  );
}

function NewElementForm({ userId, t }: { userId: string; t: TFunction }) {
  const navigation = useNavigation();
  const router = useRouter();
  const rawNodeType = useLocalSearchParams<{ nodeType?: string | string[] }>().nodeType;
  const initialNodeType = Array.isArray(rawNodeType) ? rawNodeType[0] : rawNodeType;

  const create = useMutation(api.cosplayNodes.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [nodeType, setNodeType] = useState<CosplayNodeType>(
    initialNodeType === "material" ? "material" : "element"
  );
  const [category, setCategory] = useState<CosplayCategory>(
    initialNodeType === "material" ? "material" : "other"
  );
  const [name, setName] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [directCostDollars, setDirectCostDollars] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t(
        nodeType === "material" ? "elements.newModalTitleMaterial" : "elements.newModalTitleElement"
      ),
    });
  }, [navigation, nodeType, t]);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
      setImageUrl("");
    }
  }, []);

  const onNodeTypeChange = (next: CosplayNodeType) => {
    setNodeType(next);
    setCategory(next === "material" ? "material" : "other");
  };

  const onSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    void (async () => {
      try {
        let imageStorageId: Id<"_storage"> | undefined;
        if (pickedUri) {
          const uploadUrl = await generateUploadUrl();
          imageStorageId = await uploadUriToConvexStorage(pickedUri, uploadUrl);
        }
        const trimmedUrl = imageUrl.trim();
        const directCostCents = directCostDollars.trim()
          ? Math.round(Number.parseFloat(directCostDollars.replace(",", ".")) * 100)
          : undefined;
        const qtyParsed =
          nodeType === "material" && quantity.trim()
            ? Number(quantity.replace(",", "."))
            : undefined;

        const doc = await create({
          userId,
          nodeType,
          name: trimmed,
          category,
          tags: tagsStr
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: notes.trim() || undefined,
          imageStorageId,
          imageUrl: !imageStorageId && trimmedUrl ? trimmedUrl : undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          directCostCents:
            directCostCents != null && !Number.isNaN(directCostCents) ? directCostCents : undefined,
          quantity: qtyParsed != null && !Number.isNaN(qtyParsed) ? qtyParsed : undefined,
          unit: nodeType === "material" ? unit.trim() || undefined : undefined,
          purchaseStatus: nodeType === "element" ? "to_buy" : undefined,
          buildStatus: nodeType === "element" ? "not_started" : undefined,
          materialStatus: nodeType === "material" ? "to_buy" : undefined,
        });
        if (doc?._id) {
          router.replace(APP_HREF.element(doc._id as string));
        }
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg px-4 pt-4 dark:bg-kyar-dark-bg"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {t("elements.newSubtitle")}
      </Text>

      <MetaLabel className="mt-6">{t("elements.typeLabel")}</MetaLabel>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {COSPLAY_NODE_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => onNodeTypeChange(type)}
            className={`rounded-xl border px-3 py-2 ${
              nodeType === type
                ? "border-kyar-text bg-kyar-muted dark:border-kyar-dark-text dark:bg-kyar-dark-muted"
                : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase tracking-wide ${
                nodeType === type
                  ? "text-kyar-text dark:text-kyar-dark-text"
                  : "text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
              }`}
            >
              {type === "element" ? t("elements.typeElement") : t("elements.typeMaterial")}
            </Text>
          </Pressable>
        ))}
      </View>

      <MetaLabel className="mt-6">{t("elements.newPhotoLabel")}</MetaLabel>
      <Pressable
        onPress={() => void pickPhoto()}
        className="mt-2 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-kyar-borderSubtle bg-kyar-panel py-8 active:opacity-90 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
      >
        {pickedUri ? (
          <Image source={{ uri: pickedUri }} className="h-40 w-full" resizeMode="cover" />
        ) : (
          <Text className="text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("elements.heroPick")}
          </Text>
        )}
      </Pressable>

      <TextField
        className="mt-4"
        label={t("newBuild.imageUrlLabel")}
        value={imageUrl}
        onChangeText={(text) => {
          setImageUrl(text);
          if (text.trim()) setPickedUri(null);
        }}
        placeholder={t("newBuild.imageUrlPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TextField
        className="mt-5"
        label={t("elements.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("elements.namePlaceholder")}
        autoCapitalize="sentences"
      />

      <MetaLabel className="mt-6">{t("elements.categoryLabel")}</MetaLabel>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {COSPLAY_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            className={`rounded-xl border px-3 py-2 ${
              category === c
                ? "border-kyar-text bg-kyar-muted dark:border-kyar-dark-text dark:bg-kyar-dark-muted"
                : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase tracking-wide ${
                category === c
                  ? "text-kyar-text dark:text-kyar-dark-text"
                  : "text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
              }`}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        className="mt-5"
        label={t("elements.tagsLabel")}
        value={tagsStr}
        onChangeText={setTagsStr}
        placeholder={t("elements.tagsPlaceholder")}
        autoCapitalize="none"
      />

      <TextField
        className="mt-4"
        label={t("elements.newDirectCostLabel")}
        value={directCostDollars}
        onChangeText={setDirectCostDollars}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      {nodeType === "material" ? (
        <View className="mt-4 flex-row gap-3">
          <View className="min-w-0 flex-1">
            <TextField
              label={t("elements.quantityLabel")}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="0"
              keyboardType="decimal-pad"
            />
          </View>
          <View className="min-w-0 flex-1">
            <TextField
              label={t("elements.unitLabel")}
              value={unit}
              onChangeText={setUnit}
              placeholder={t("elements.unitPlaceholder")}
            />
          </View>
        </View>
      ) : null}

      <TextField
        className="mt-4"
        label={t("elements.newSourceUrlLabel")}
        value={sourceUrl}
        onChangeText={setSourceUrl}
        placeholder={t("elements.newSourceUrlPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <TextField
        className="mt-4"
        label={t("elements.notesLabel")}
        value={notes}
        onChangeText={setNotes}
        placeholder={t("elements.notesPlaceholder")}
        multiline
      />

      <Button
        title={
          pending
            ? t("elements.creating")
            : nodeType === "material"
              ? t("elements.newSaveMaterial")
              : t("elements.newSaveElement")
        }
        onPress={onSubmit}
        disabled={pending || !name.trim()}
        className="mt-8 mb-8"
      />
    </ScrollView>
  );
}
