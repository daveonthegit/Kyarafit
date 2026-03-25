import { View, Text, Image, type ImageSourcePropType } from "react-native";
import { colors, font, radius } from "@kyarafit/design-system/rn";

export type AvatarProps = {
  size?: number;
  uri?: string | null;
  label?: string;
};

function initialsFromLabel(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function Avatar({ size = 40, uri, label = "" }: AvatarProps) {
  const side = size;
  const source: ImageSourcePropType | null = uri ? { uri } : null;

  return (
    <View
      style={{
        width: side,
        height: side,
        borderRadius: side / 2,
        backgroundColor: colors.muted,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      {source ? (
        <Image source={source} style={{ width: side, height: side }} resizeMode="cover" />
      ) : (
        <Text
          style={{
            fontSize: Math.max(10, side * 0.32),
            fontFamily: font.family.sansWide,
            fontWeight: "600",
            color: colors.textSecondary,
          }}
        >
          {initialsFromLabel(label)}
        </Text>
      )}
    </View>
  );
}
