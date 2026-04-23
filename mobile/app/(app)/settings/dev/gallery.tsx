import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

/** KFM-025 — expand with live tokens and primitive previews as UI ships. */
export default function DevGalleryScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("settings.devGallery") }} />
      <View className="flex-1 bg-white px-5 pt-6">
        <Text className="text-neutral-900 text-lg font-semibold">Design system</Text>
        <Text className="mt-2 text-neutral-600">
          Shared primitives live in <Text className="font-mono text-sm">mobile/src/ui</Text>. This
          screen will host interactive previews aligned with §3.7.
        </Text>
      </View>
    </>
  );
}
