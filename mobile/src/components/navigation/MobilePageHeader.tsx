import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { Href } from "expo-router";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { MobileBackButton } from "./MobileBackButton";

type Props = {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  fallbackHref?: Href;
  containerClassName?: string;
};

export function MobilePageHeader({
  title,
  eyebrow,
  subtitle,
  fallbackHref,
  containerClassName,
}: Props) {
  return (
    <View className={["flex-row items-start gap-3", containerClassName].filter(Boolean).join(" ")}>
      <MobileBackButton fallbackHref={fallbackHref} className="mt-1" />
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text className="text-[10px] font-bold uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta">
            {eyebrow}
          </Text>
        ) : null}
        <Text
          className="mt-1 text-3xl italic text-kyar-text dark:text-kyar-dark-text"
          style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
