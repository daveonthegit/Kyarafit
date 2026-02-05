import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import { colors, radius, font, spacing } from "@kyarafit/design-system/rn";

type Variant = "primary" | "secondary" | "text";

interface ButtonProps {
  variant?: Variant;
  onPress?: () => void;
  disabled?: boolean;
  children: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  variant = "primary",
  onPress,
  disabled,
  children,
  style,
  textStyle,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isText = variant === "text";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isText && styles.textVariant,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          isPrimary && styles.primaryLabel,
          (isSecondary || isText) && styles.secondaryLabel,
          disabled && styles.disabledLabel,
          textStyle,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    paddingHorizontal: spacing[4],
    borderRadius: radius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: {
    backgroundColor: colors.text,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  textVariant: {
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    borderRadius: 0,
  },
  disabled: {
    opacity: 0.25,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: font.size.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: font.tracking.wider * font.size.xs,
  },
  primaryLabel: {
    color: colors.bg,
  },
  secondaryLabel: {
    color: colors.text,
  },
  disabledLabel: {
    color: colors.textMuted,
  },
});
