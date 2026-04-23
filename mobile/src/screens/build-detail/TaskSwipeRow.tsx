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
        className="h-full min-w-[88px] items-center justify-center rounded-2xl bg-kyar-text px-4 active:opacity-90 dark:bg-kyar-dark-text"
      >
        <Text className="text-center text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
          {checked ? t("buildDetail.taskMarkOpen") : t("buildDetail.taskMarkDone")}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable renderRightActions={() => actions} overshootRight={false}>
      <View className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface">
        {children}
      </View>
    </Swipeable>
  );
}
