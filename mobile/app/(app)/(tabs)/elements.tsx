import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export default function ElementsPlaceholder() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-center text-lg font-semibold text-neutral-900">{t("common.elements")}</Text>
      <Text className="mt-2 text-center text-neutral-500">Elements parity — Phase 4 (blueprint §2.5).</Text>
    </View>
  );
}
