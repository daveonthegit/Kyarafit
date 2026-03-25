import { Pressable, Text, View, type PressableProps, type ViewStyle } from "react-native";
import { colors, font, ls } from "@kyarafit/design-system/rn";
import { KyarIcon } from "./KyarIcon";

export type SettingsRowProps = Omit<PressableProps, "style"> & {
  label: string;
  value?: string;
  destructive?: boolean;
  style?: ViewStyle;
};

export function SettingsRow({ label, value, destructive, ...rest }: SettingsRowProps) {
  return (
    <Pressable
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      }}
      {...rest}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: font.family.sansWide,
          fontWeight: "500",
          letterSpacing: ls(0.2, 11),
          textTransform: "uppercase",
          color: destructive ? colors.danger : colors.text,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {value ? (
          <Text style={{ fontSize: font.size.sm, color: colors.textSecondary }}>{value}</Text>
        ) : null}
        {!destructive ? (
          <KyarIcon name="chevron_right" size={18} color={colors.textTertiary} />
        ) : null}
      </View>
    </Pressable>
  );
}
