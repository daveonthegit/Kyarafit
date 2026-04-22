import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { DataBoundary } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";

export default function NewBuildScreen() {
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
  const data: Ready | undefined =
    status === "ready" && userId ? { userId } : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => <NewBuildForm userId={loaded.userId} t={t} />}
    </DataBoundary>
  );
}

function NewBuildForm({
  userId,
  t,
}: {
  userId: string;
  t: (key: string) => string;
}) {
  const router = useRouter();
  const createBuild = useMutation(api.builds.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [name, setName] = useState("");
  const [character, setCharacter] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  const pickHero = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
    }
  }, []);

  const submit = useCallback(async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      let storageId: Id<"_storage"> | undefined;
      if (pickedUri) {
        const uploadUrl = await generateUploadUrl();
        storageId = await uploadUriToConvexStorage(pickedUri, uploadUrl);
      }
      const created = await createBuild({
        userId,
        name: n,
        character: character.trim() || undefined,
        status: "idea",
        imageStorageId: storageId,
      });
      if (created?._id) {
        router.replace(APP_HREF.build(created._id));
      }
    } finally {
      setBusy(false);
    }
  }, [busy, character, createBuild, generateUploadUrl, name, pickedUri, router, userId]);

  return (
    <ScrollView className="flex-1 bg-white px-4 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-2xl font-semibold text-neutral-900">{t("newBuild.title")}</Text>
      <Text className="mt-1 text-sm text-neutral-600">{t("newBuild.subtitle")}</Text>

      <Text className="mt-6 text-xs font-semibold uppercase text-neutral-500">{t("newBuild.nameLabel")}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t("newBuild.namePlaceholder")}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-neutral-900"
      />

      <Text className="mt-4 text-xs font-semibold uppercase text-neutral-500">
        {t("newBuild.characterLabel")}
      </Text>
      <TextInput
        value={character}
        onChangeText={setCharacter}
        placeholder={t("newBuild.characterPlaceholder")}
        className="mt-1 rounded-xl border border-neutral-200 px-3 py-2.5 text-neutral-900"
      />

      <Text className="mt-6 text-xs font-semibold uppercase text-neutral-500">{t("newBuild.heroLabel")}</Text>
      <Pressable
        onPress={() => void pickHero()}
        className="mt-2 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-400 bg-neutral-50 py-8 active:opacity-90"
      >
        {pickedUri ? (
          <Image source={{ uri: pickedUri }} className="h-48 w-full" resizeMode="cover" />
        ) : (
          <Text className="text-neutral-500">{t("newBuild.heroPick")}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => void submit()}
        disabled={busy || !name.trim()}
        className={`mt-8 items-center rounded-xl py-3 ${busy || !name.trim() ? "bg-neutral-300" : "bg-neutral-900"} active:opacity-90`}
      >
        <Text className="font-semibold text-white">{busy ? t("newBuild.creating") : t("newBuild.create")}</Text>
      </Pressable>
    </ScrollView>
  );
}
