import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

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
  const base =
    variant === "primary"
      ? "rounded-xl bg-neutral-900 px-4 py-3 active:opacity-90"
      : "rounded-xl border border-neutral-300 bg-white px-4 py-3 active:opacity-90";
  const text =
    variant === "primary" ? "text-center font-semibold text-white" : "text-center font-semibold text-neutral-900";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled ?? loading}
      className={[base, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#171717"} />
      ) : (
        <Text className={text}>{title}</Text>
      )}
    </Pressable>
  );
}
