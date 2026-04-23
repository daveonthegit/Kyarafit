import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { useDesignTheme } from "@/theme/useDesignTheme";

type Props = PressableProps & {
  title: string;
  variant?: "primary" | "secondary";
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  className,
  ...rest
}: Props) {
  const { colors } = useDesignTheme();
  const base =
    variant === "primary"
      ? "rounded-xl bg-kyar-text px-4 py-3 active:opacity-90 dark:bg-kyar-dark-text"
      : "rounded-xl border border-kyar-border bg-kyar-surface px-4 py-3 active:opacity-90 dark:border-kyar-dark-border dark:bg-kyar-dark-surface";
  const text =
    variant === "primary"
      ? "text-center font-semibold text-kyar-bg dark:text-kyar-dark-bg"
      : "text-center font-semibold text-kyar-text dark:text-kyar-dark-text";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled ?? loading}
      className={[base, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.bg : colors.text} />
      ) : (
        <Text className={text}>{title}</Text>
      )}
    </Pressable>
  );
}
