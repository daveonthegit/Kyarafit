import { View, Text } from "react-native";
import { colors, font, layout, radius, shadow } from "@kyarafit/design-system/rn";
import { KyarIcon, type KyarIconName } from "./KyarIcon";

export type EmptyStateProps = {
  message: string;
  secondary?: string;
  icon?: KyarIconName;
  action?: React.ReactNode;
};

export function EmptyState({ message, secondary, icon = "image", action }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 48,
        paddingHorizontal: 16,
        marginHorizontal: layout.screenPaddingX - 4,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.lg * 2,
        ...shadow.soft,
      }}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <KyarIcon name={icon} size={40} color={colors.textTertiary} />
      <Text
        style={{
          marginTop: 16,
          textAlign: "center",
          fontSize: font.size.sm,
          color: colors.textSecondary,
        }}
      >
        {message}
      </Text>
      {secondary ? (
        <Text
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: font.size.xs,
            color: colors.textTertiary,
          }}
        >
          {secondary}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 24 }}>{action}</View> : null}
    </View>
  );
}
