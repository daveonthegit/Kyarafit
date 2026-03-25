import { Text, View, type ViewProps } from "react-native";
import { colors, font, ls, radius } from "@kyarafit/design-system/rn";

export type BadgeProps = ViewProps & {
  children: string;
  variant?: "default" | "muted";
};

export function Badge({ children, variant = "default", style, ...rest }: BadgeProps) {
  const muted = variant === "muted";
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: radius.md,
          backgroundColor: muted ? colors.muted : colors.text,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          fontSize: font.size.xs,
          fontFamily: font.family.sansWide,
          fontWeight: "600",
          letterSpacing: ls(0.25, font.size.xs),
          textTransform: "uppercase",
          color: muted ? colors.textSecondary : colors.bg,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
