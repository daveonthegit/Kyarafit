import { Text, type TextProps } from "react-native";
import { colors, font, ls } from "@kyarafit/design-system/rn";

export type SectionLabelProps = TextProps & {
  children: string;
};

/** Slightly larger uppercase section label (e.g. "Upcoming Events"). */
export function SectionLabel({ style, children, ...rest }: SectionLabelProps) {
  return (
    <Text
      style={[
        {
          fontSize: 11,
          fontFamily: font.family.sansWide,
          fontWeight: "600",
          letterSpacing: ls(0.2, 11),
          textTransform: "uppercase",
          color: colors.text,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
