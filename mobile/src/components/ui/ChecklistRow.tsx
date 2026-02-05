import { Pressable, View, Text, StyleSheet } from "react-native";
import { colors, font } from "@kyarafit/design-system/rn";

interface ChecklistRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  code?: string;
}

export function ChecklistRow({
  label,
  checked,
  onToggle,
  code,
}: ChecklistRowProps) {
  return (
    <Pressable onPress={onToggle} style={styles.row}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <View style={styles.checkmark} /> : null}
      </View>
      <Text
        style={[styles.label, checked && styles.labelChecked]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {code ? <Text style={styles.code}>{code}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.text,
  },
  checkmark: {
    width: 6,
    height: 6,
    backgroundColor: colors.bg,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.text,
  },
  labelChecked: {
    opacity: 0.6,
    textDecorationLine: "line-through",
  },
  code: {
    fontSize: 10,
    color: colors.textTertiary,
  },
});
