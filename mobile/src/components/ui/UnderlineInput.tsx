import { View, TextInput, Text, StyleSheet } from "react-native";
import { colors, font } from "@kyarafit/design-system/rn";

interface UnderlineInputProps {
  label?: string;
  value?: string;
  placeholder?: string;
  error?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  secureTextEntry?: boolean;
  editable?: boolean;
  keyboardType?: "default" | "number-pad" | "decimal-pad" | "numeric" | "email-address" | "phone-pad";
}

export function UnderlineInput({
  label,
  value,
  placeholder,
  error,
  onChangeText,
  onFocus,
  onBlur,
  secureTextEntry,
  editable = true,
  keyboardType,
}: UnderlineInputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        editable={editable}
        keyboardType={keyboardType}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.meta,
    marginBottom: 4,
  },
  input: {
    fontSize: font.size.sm,
    color: colors.text,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    backgroundColor: "transparent",
  },
  inputError: {
    borderBottomColor: colors.danger,
  },
  errorText: {
    fontSize: font.size.xs,
    color: colors.danger,
    marginTop: 4,
  },
});
