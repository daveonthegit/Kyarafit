import { Text, TextInput, View, type TextInputProps } from "react-native";
import { useDesignTheme } from "@/theme/useDesignTheme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, className, ...rest }: Props) {
  const { colors } = useDesignTheme();

  return (
    <View className="w-full">
      {label ? (
        <Text className="mb-1 text-sm font-medium text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {label}
        </Text>
      ) : null}
      <TextInput
        className={[
          "rounded-xl border border-kyar-border bg-kyar-surface px-3 py-3 text-base text-kyar-text dark:border-kyar-dark-border dark:bg-kyar-dark-surface dark:text-kyar-dark-text",
          error ? "border-kyar-danger dark:border-kyar-dark-danger" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        placeholderTextColor={colors.textTertiary}
        {...rest}
      />
      {error ? (
        <Text className="mt-1 text-sm text-kyar-danger dark:text-kyar-dark-danger">{error}</Text>
      ) : null}
    </View>
  );
}
