import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { glass } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Primary message */
  message: string;
  /** Optional secondary line */
  secondary?: string;
  /** Optional CTA node (e.g. a PhotoPill) */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Empty state rendered light-on-glass/photo (surface rule 11) — icon +
 * message + CTA, no card chrome; background comes from the parent surface.
 */
export function GlassEmptyState({ icon, message, secondary, action, style }: Props) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 64,
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={36} color={glass.text.fg45} style={{ marginBottom: 16 }} />
      ) : null}
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 14,
          color: glass.text.fg,
          textAlign: "center",
          marginBottom: 4,
        }}
      >
        {message}
      </Text>
      {secondary ? (
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansRegular,
            fontSize: 12,
            color: glass.text.fg55,
            textAlign: "center",
          }}
        >
          {secondary}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 24 }}>{action}</View> : null}
    </View>
  );
}
