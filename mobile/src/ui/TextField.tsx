import { Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, className, ...rest }: Props) {
  return (
    <View className="w-full">
      {label ? <Text className="mb-1 text-sm font-medium text-neutral-700">{label}</Text> : null}
      <TextInput
        className={[
          "rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900",
          error ? "border-red-500" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        placeholderTextColor="#a3a3a3"
        {...rest}
      />
      {error ? <Text className="mt-1 text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
