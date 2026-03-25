import { Text, type TextProps } from "react-native";
import { colors, font, ls } from "@kyarafit/design-system/rn";

export type MetaLabelProps = TextProps & {
  children: string;
};

/** Smallest uppercase meta line (e.g. section kicker). */
export function MetaLabel({ style, children, ...rest }: MetaLabelProps) {
  return (
    <Text
      style={[
        {
          fontSize: 9,
          fontFamily: font.family.sansWide,
          fontWeight: "600",
          letterSpacing: ls(0.2, 9),
          textTransform: "uppercase",
          color: colors.meta,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
