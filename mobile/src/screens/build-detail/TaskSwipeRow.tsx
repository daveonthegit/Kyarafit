import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

type Props = {
  children: ReactNode;
  checked: boolean;
  onToggle: () => void;
};

export function TaskSwipeRow({ children, checked, onToggle }: Props) {
  const { t } = useTranslation();

  const actions = (
    <View className="justify-center pr-2">
      <Pressable
        onPress={onToggle}
        className="h-full min-w-[88px] items-center justify-center rounded-xl bg-neutral-900 px-4 active:opacity-90"
      >
        <Text className="text-center text-sm font-semibold text-white">
          {checked ? t("buildDetail.taskMarkOpen") : t("buildDetail.taskMarkDone")}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable renderRightActions={() => actions} overshootRight={false}>
      <View className="rounded-xl border border-neutral-200 bg-white">{children}</View>
    </Swipeable>
  );
}
