import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

export default function SettingsNotificationsScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("settings.notificationStyle"), headerLargeTitle: false }} />
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        contentContainerClassName="px-5 pb-12 pt-4"
      >
        <SectionHeading eyebrow={t("common.settings")} title={t("settings.notificationStyle")} />
        <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("settings.notificationsSubtitle")}
        </Text>

        <SurfaceCard className="mt-5 px-4 py-4">
          <MetaLabel>{t("settings.notificationStyle")}</MetaLabel>
          <Text className="mt-3 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
            {t("settings.notificationsSoonTitle")}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("settings.notificationsSoonBody")}
          </Text>
          <View className="mt-4 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel">
            <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("settings.notificationsRoadmap")}
            </Text>
          </View>
        </SurfaceCard>
      </ScrollView>
    </>
  );
}
