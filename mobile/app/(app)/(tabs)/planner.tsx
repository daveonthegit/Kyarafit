import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";

export default function PlannerPlaceholder() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-kyar-bg px-6">
      <Text className="text-center text-lg font-semibold text-kyar-text">{t("common.planner")}</Text>
      <Text className="mt-2 text-center text-kyar-textSecondary">Planner parity — Phase 6 (blueprint §2.7).</Text>
    </View>
  );
}
