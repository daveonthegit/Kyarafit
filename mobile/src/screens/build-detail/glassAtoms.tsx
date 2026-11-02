import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

/**
 * Glass Studio presentation atoms private to the build-detail screen (7c/7d/8b).
 * Pure presentation — no data, no gestures. Frozen primitives live in
 * `@/ui/glass`; these are only the tiny text/row helpers this screen repeats.
 */

type MetaTone = "fg" | "fg70" | "fg55" | "fg45" | "danger" | "ink";

const META_COLOR: Record<MetaTone, string> = {
  fg: glass.text.fg,
  fg70: glass.text.fg70,
  fg55: glass.text.fg55,
  fg45: glass.text.fg45,
  danger: glass.text.danger,
  ink: glass.text.ink,
};

/** Uppercase tracked meta text on glass (card caption 9px / label 10px tiers). */
export function GlassMeta({
  children,
  size = 9,
  tone = "fg55",
  tracking = 0.16,
  bold = false,
  style,
  ...rest
}: TextProps & {
  children: ReactNode;
  size?: number;
  tone?: MetaTone;
  tracking?: number;
  bold?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: bold ? APP_FONT_FAMILIES.sansBold : APP_FONT_FAMILIES.sansMedium,
          fontSize: size,
          letterSpacing: ls(tracking, size),
          textTransform: "uppercase",
          color: META_COLOR[tone],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Sentence-case body text on glass (list content, 12–14px sans). */
export function GlassBody({
  children,
  size = 13,
  tone = "fg70",
  semiBold = false,
  style,
  ...rest
}: TextProps & {
  children: ReactNode;
  size?: number;
  tone?: MetaTone;
  semiBold?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: semiBold ? APP_FONT_FAMILIES.sansSemiBold : APP_FONT_FAMILIES.sansRegular,
          fontSize: size,
          lineHeight: Math.round(size * 1.45),
          color: META_COLOR[tone],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** 2px progress hairline: divider track, light fill. */
export function GlassHairlineProgress({
  percent,
  style,
}: {
  percent: number;
  style?: StyleProp<ViewStyle>;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View
      style={[
        {
          height: 2,
          borderRadius: 1,
          backgroundColor: glass.border.divider,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={{
          height: 2,
          width: `${clamped}%`,
          borderRadius: 1,
          backgroundColor: glass.text.fg,
        }}
      />
    </View>
  );
}

/** Full-width solid-light primary button (the ONE solid per visible surface). */
export function GlassSolidButton({
  label,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="active:opacity-80"
      style={[
        {
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: glass.surface.solid,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 11,
          letterSpacing: ls(0.16, 11),
          textTransform: "uppercase",
          color: glass.text.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Full-width glass-outline secondary button (danger tint optional). */
export function GlassOutlineButton({
  label,
  danger = false,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="active:opacity-80"
      style={[
        {
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          borderWidth: 1,
          borderColor: danger ? glass.text.danger : glass.border.strong,
          backgroundColor: glass.surface.bar,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 11,
          letterSpacing: ls(0.16, 11),
          textTransform: "uppercase",
          color: danger ? glass.text.danger : glass.text.fg,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
