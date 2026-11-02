import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

export function MetaLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text
      style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
      className={[
        "text-[10px] font-bold uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Text>
  );
}

export function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={[
        "rounded-3xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </View>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-end justify-between gap-4">
      <View className="min-w-0 flex-1">
        {eyebrow ? <MetaLabel>{eyebrow}</MetaLabel> : null}
        <Text className="mt-1 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}
