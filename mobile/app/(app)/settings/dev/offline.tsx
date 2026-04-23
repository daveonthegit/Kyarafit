import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { usePendingQueueCount } from "@/offline";

export default function DevOfflineScreen() {
  const { t } = useTranslation();
  const pending = usePendingQueueCount();

  return (
    <>
      <Stack.Screen options={{ title: t("settings.devOffline") }} />
      <View className="flex-1 bg-white px-5 pt-6">
        <Text className="text-neutral-600">{t("settings.devOfflineSubtitle")}</Text>
        <View className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
          <Text className="text-sm font-medium text-neutral-600">
            {t("settings.pendingMutations")}
          </Text>
          <Text className="mt-2 text-3xl font-semibold text-neutral-900">{pending}</Text>
        </View>
      </View>
    </>
  );
}
