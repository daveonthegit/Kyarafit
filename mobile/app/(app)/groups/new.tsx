import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { APP_HREF } from "@/lib/appRoutes";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard, TextField } from "@/ui";

export default function NewGroupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [saving, setSaving] = useState(false);
  const status = identity === undefined ? "loading" : "ready";

  const handleCreate = async () => {
    if (!userId || !name.trim() || saving) return;
    setSaving(true);
    try {
      const group = await createGroup({
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      if (group?._id) router.replace(APP_HREF.group(group._id));
      else router.replace(APP_HREF.groups);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("groups.createAction"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ ready: true }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <SectionHeading eyebrow={t("nav.groups")} title={t("groups.createTitle")} />
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("groups.createSubtitle")}
            </Text>

            <SurfaceCard className="mt-5 gap-4 px-4 py-4">
              <TextField
                label={t("groups.nameLabel")}
                value={name}
                onChangeText={setName}
                placeholder={t("groups.namePlaceholder")}
              />
              <TextField
                label={t("groups.descriptionLabel")}
                value={description}
                onChangeText={setDescription}
                placeholder={t("groups.descriptionPlaceholder")}
                multiline
                className="min-h-[112px]"
              />

              <View>
                <MetaLabel>{t("groups.visibilityLabel")}</MetaLabel>
                <View className="mt-3 flex-row gap-2">
                  {(
                    [
                      ["private", t("groups.visibilityPrivate")],
                      ["public", t("groups.visibilityPublic")],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => setVisibility(value)}
                      className={`rounded-full border px-4 py-3 ${
                        visibility === value
                          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          visibility === value
                            ? "text-kyar-bg dark:text-kyar-dark-bg"
                            : "text-kyar-text dark:text-kyar-dark-text"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Button
                title={saving ? t("groups.creating") : t("groups.createAction")}
                onPress={() => void handleCreate()}
                loading={saving}
                disabled={!name.trim()}
              />
            </SurfaceCard>
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}
