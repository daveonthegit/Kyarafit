import { useLayoutEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import type { TFunction } from "i18next";
import { DataBoundary, TextField } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";

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

  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState<CosplayNodeType>(
    initialNodeType === "material" ? "material" : "element"
  );
  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t(nodeType === "material" ? "elements.newMaterialTitle" : "elements.newTitle"),
    });
  }, [navigation, nodeType, t]);

  const onSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    void (async () => {
      try {
        const doc = await create({
          userId,
          nodeType,
          name: trimmed,
          tags: [],
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
    <ScrollView className="flex-1 bg-white px-4 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-neutral-900">{t("elements.newTitle")}</Text>
      <Text className="mt-1 text-sm text-neutral-500">{t("elements.newSubtitle")}</Text>

      <TextField
        label={t("elements.nameLabel")}
        value={name}
        onChangeText={setName}
        placeholder={t("elements.namePlaceholder")}
        autoCapitalize="sentences"
      />

      <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {t("elements.typeLabel")}
      </Text>
      <View className="mt-2 flex-row gap-2">
        {(["element", "material"] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setNodeType(type)}
            className={`flex-1 rounded-xl border px-3 py-3 ${
              nodeType === type
                ? "border-neutral-900 bg-neutral-900"
                : "border-neutral-200 bg-white"
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                nodeType === type ? "text-white" : "text-neutral-800"
              }`}
            >
              {type === "element" ? t("elements.typeElement") : t("elements.typeMaterial")}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        disabled={pending || !name.trim()}
        onPress={onSubmit}
        className={`mt-8 rounded-xl py-4 ${pending || !name.trim() ? "bg-neutral-300" : "bg-neutral-900"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {pending ? t("elements.creating") : t("elements.create")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
