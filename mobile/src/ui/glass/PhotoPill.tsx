import { Pressable, Text, View, type PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

type Variant = "solid" | "outline" | "text";
type Size = "md" | "sm";

type PhotoPillProps = Omit<PressableProps, "children" | "style"> & {
  /**
   * solid — the ONE primary per view: solid light fill, ink text (QA-3).
   * outline — secondary: glass-outline pill on bar-weight glass.
   * text — tertiary: underlined uppercase meta.
   */
  variant?: Variant;
  /** md = standalone actions (44pt tap target); sm = dense in-panel chrome. */
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
};

const SIZES: Record<Size, { minHeight: number; paddingHorizontal: number; fontSize: number }> = {
  md: { minHeight: 44, paddingHorizontal: 22, fontSize: 10 },
  sm: { minHeight: 34, paddingHorizontal: 16, fontSize: 9 },
};

/**
 * Button for glass/photo surfaces (surface rule 5). The cream `Button`
 * survives on not-yet-converted screens only.
 */
export function PhotoPill({
  variant = "solid",
  size = "md",
  icon,
  label,
  disabled,
  ...rest
}: PhotoPillProps) {
  const sizing = SIZES[size];
  const foreground = variant === "solid" ? glass.text.ink : glass.text.fg;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: "flex-start",
          gap: 8,
          minHeight: sizing.minHeight,
          borderRadius: variant === "text" ? 0 : 999,
          paddingHorizontal: variant === "text" ? 2 : sizing.paddingHorizontal,
        },
        variant === "solid" && { backgroundColor: glass.surface.solid },
        variant === "outline" && {
          backgroundColor: glass.surface.bar,
          borderWidth: 1,
          borderColor: glass.border.strong,
        },
        pressed && !disabled && { transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.25 },
      ]}
      {...rest}
    >
      {icon ? (
        <Ionicons name={icon} size={size === "sm" ? 14 : 15} color={foreground} />
      ) : null}
      <View
        style={
          variant === "text"
            ? { borderBottomWidth: 1, borderBottomColor: foreground, paddingBottom: 2 }
            : undefined
        }
      >
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: sizing.fontSize,
            letterSpacing: ls(0.16, sizing.fontSize),
            textTransform: "uppercase",
            color: foreground,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
