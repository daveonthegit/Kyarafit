import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";

import { usePendingQueueCount } from "@/offline";
import { SyncStatusSection } from "@/components/settings/SyncStatusSection";
import { MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

export default function SettingsOfflineScreen() {
  const { t } = useTranslation();
  const pending = usePendingQueueCount();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => {
      unsub();
    };
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: t("settings.offlineCapability"), headerLargeTitle: false }} />
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        contentContainerClassName="px-5 pb-12 pt-4"
      >
        <SectionHeading eyebrow={t("common.settings")} title={t("settings.offlineCapability")} />
        <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("settings.offlineCapabilityIntro")}
        </Text>

        <SurfaceCard className="mt-5 px-4 py-4">
          <MetaLabel>{t("settings.connectionStatus")}</MetaLabel>
          <Text className="mt-3 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
            {offline ? t("settings.connectionOffline") : t("settings.connectionOnline")}
          </Text>
        </SurfaceCard>

        <SyncStatusSection offline={offline} />

        <SurfaceCard className="mt-4 px-4 py-4">
          <MetaLabel>{t("settings.pendingMutations")}</MetaLabel>
          <Text className="mt-3 font-serif text-4xl italic text-kyar-text dark:text-kyar-dark-text">
            {pending}
          </Text>
          <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("settings.pendingMutationsHint")}
          </Text>
        </SurfaceCard>

        <View className="mt-5 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel">
          <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("settings.offlineCapabilityFootnote")}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

