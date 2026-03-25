import { Pressable, Text, View, type PressableProps, type ViewStyle } from "react-native";
import { colors, font } from "@kyarafit/design-system/rn";
import { KyarIcon } from "./KyarIcon";

export type ListRowProps = Omit<PressableProps, "style"> & {
  title: string;
  subtitle?: string;
  showChevron?: boolean;
  leading?: React.ReactNode;
  style?: ViewStyle;
};

export function ListRow({
  title,
  subtitle,
  showChevron = true,
  leading,
  style,
  ...rest
}: ListRowProps) {
  return (
    <Pressable
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        },
        style,
      ]}
      {...rest}
    >
      {leading ? <View style={{ marginRight: 12 }}>{leading}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: font.size.base, fontWeight: "500", color: colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 4, fontSize: font.size.xs, color: colors.textSecondary }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showChevron ? <KyarIcon name="chevron_right" size={20} color={colors.textTertiary} /> : null}
    </Pressable>
  );
}
