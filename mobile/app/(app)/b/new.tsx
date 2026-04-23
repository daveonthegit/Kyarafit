import { useCallback, useLayoutEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BUILD_STATUSES, type BuildStatus } from "@kyarafit/design-system/types";
import { DataBoundary, MetaLabel, Button, TextField } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";

export default function NewBuildScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("newBuild.title") });
  }, [navigation, t]);

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
      {(loaded) => <NewBuildForm userId={loaded.userId} />}
    </DataBoundary>
  );
}

function NewBuildForm({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const createBuild = useMutation(api.builds.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [name, setName] = useState("");
  const [status, setStatus] = useState<BuildStatus>("idea");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [budgetDollars, setBudgetDollars] = useState("");
  const [busy, setBusy] = useState(false);

  const hasImage = pickedUri != null || imageUrl.trim() !== "";

  const pickHero = useCallback(async () => {
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

  const submit = useCallback(async () => {
    const n = name.trim();
    if (!n || busy || !hasImage) return;
    setBusy(true);
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (pickedUri) {
        const uploadUrl = await generateUploadUrl();
        imageStorageId = await uploadUriToConvexStorage(pickedUri, uploadUrl);
      }
      const trimmedUrl = imageUrl.trim();
      const budgetCents = budgetDollars.trim()
        ? Math.round(Number.parseFloat(budgetDollars.replace(",", ".")) * 100)
        : undefined;

      const created = await createBuild({
        userId,
        name: n,
        status,
        imageStorageId,
        imageUrl: !imageStorageId && trimmedUrl ? trimmedUrl : undefined,
        budgetCents: budgetCents != null && !Number.isNaN(budgetCents) ? budgetCents : undefined,
      });
      if (created?._id) {
        router.replace(APP_HREF.build(created._id));
      }
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    budgetDollars,
    createBuild,
    generateUploadUrl,
    hasImage,
    imageUrl,
    name,
    pickedUri,
    router,
    status,
    t,
    userId,
  ]);

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg px-4 pt-4 dark:bg-kyar-dark-bg"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {t("newBuild.intro")}
      </Text>

      <TextField
        className="mt-5"
        label={t("newBuild.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("newBuild.namePlaceholder")}
        autoCapitalize="sentences"
      />

      <MetaLabel className="mt-6">{t("newBuild.imageSectionLabel")}</MetaLabel>
      <Pressable
        onPress={() => void pickHero()}
        className="mt-2 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-kyar-borderSubtle bg-kyar-panel py-8 active:opacity-90 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
      >
        {pickedUri ? (
          <Image source={{ uri: pickedUri }} className="h-48 w-full" resizeMode="cover" />
        ) : (
          <Text className="text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("newBuild.heroPick")}
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
      {!hasImage ? (
        <Text className="mt-2 text-xs text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
          {t("newBuild.imageRequiredHint")}
        </Text>
      ) : null}

      <TextField
        className="mt-5"
        label={t("newBuild.budgetLabel")}
        value={budgetDollars}
        onChangeText={setBudgetDollars}
        placeholder={t("newBuild.budgetPlaceholder")}
        keyboardType="decimal-pad"
      />

      <MetaLabel className="mt-6">{t("newBuild.statusLabel")}</MetaLabel>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {BUILD_STATUSES.map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatus(s)}
            className={`rounded-xl border px-3 py-2 ${
              status === s
                ? "border-kyar-text bg-kyar-muted dark:border-kyar-dark-text dark:bg-kyar-dark-muted"
                : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase tracking-wide ${
                status === s
                  ? "text-kyar-text dark:text-kyar-dark-text"
                  : "text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
              }`}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        title={busy ? t("newBuild.creating") : t("newBuild.create")}
        onPress={() => void submit()}
        disabled={busy || !name.trim() || !hasImage}
        className="mt-8"
      />
    </ScrollView>
  );
}
