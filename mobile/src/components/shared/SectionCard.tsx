import { View, Text, Pressable, type ViewProps } from "react-native";
import { colors, font, layout, ls, radius, shadow } from "@kyarafit/design-system/rn";

export type SectionCardProps = ViewProps & {
  title?: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
};

/**
 * Card shell aligned with web `SectionCard`: rounded-2xl, soft border, optional meta header strip.
 */
export function SectionCard({ title, action, children, style, ...rest }: SectionCardProps) {
  return (
    <View
      style={[
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: colors.surface,
          overflow: "hidden",
          ...shadow.soft,
        },
        style,
      ]}
      {...rest}
    >
      {(title || action) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: layout.screenPaddingX - 4,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
          }}
        >
          {title ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: font.family.sansWide,
                fontWeight: "600",
                letterSpacing: ls(0.2, 11),
                textTransform: "uppercase",
                color: colors.meta,
              }}
            >
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action ? (
            <Pressable onPress={action.onPress} hitSlop={8}>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: font.family.sansWide,
                  fontWeight: "600",
                  letterSpacing: ls(0.4, 10),
                  textTransform: "uppercase",
                  color: colors.accent,
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <View style={{ padding: layout.screenPaddingX - 4 }}>{children}</View>
    </View>
  );
}
