import { View, Text, Pressable } from "react-native";
import { Link, Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { APP_HREF } from "@/lib/appRoutes";

export default function SettingsIndexScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("settings.title"), headerLargeTitle: true }} />
      <View className="flex-1 bg-white px-5 pt-4">
        <Text className="text-neutral-600">{t("settings.subtitle")}</Text>

        <Link href={APP_HREF.settingsAppearance} asChild>
          <Pressable className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 active:opacity-90">
            <Text className="text-base font-semibold text-neutral-900">{t("settings.appearance")}</Text>
            <Text className="mt-1 text-sm text-neutral-600">{t("settings.appearanceSubtitle")}</Text>
          </Pressable>
        </Link>

        <Text className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("settings.devLabs")}
        </Text>
        <Link href={APP_HREF.settingsDevGallery} asChild>
          <Pressable className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 active:opacity-90">
            <Text className="text-base font-semibold text-neutral-900">{t("settings.devGallery")}</Text>
            <Text className="mt-1 text-sm text-neutral-600">{t("settings.devGallerySubtitle")}</Text>
          </Pressable>
        </Link>
        <Link href={APP_HREF.settingsDevOffline} asChild>
          <Pressable className="mt-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 active:opacity-90">
            <Text className="text-base font-semibold text-neutral-900">{t("settings.devOffline")}</Text>
            <Text className="mt-1 text-sm text-neutral-600">{t("settings.devOfflineSubtitle")}</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
