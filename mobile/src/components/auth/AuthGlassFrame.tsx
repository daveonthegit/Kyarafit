import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { GlassOverlay, PhotoBackdrop } from "@/ui/glass";

/** Bundled auth photo (same shot web uses) — resolved once at module level. */
export const AUTH_BACKDROP_URI = Image.resolveAssetSource(
  require("../../../assets/images/auth-backdrop.jpg")
).uri;

/** Web `meta-label` on glass: 10px caps, wide tracking, 70% light. */
export const authGlassLabelStyle: TextStyle = {
  fontFamily: APP_FONT_FAMILIES.sansBold,
  fontSize: 10,
  letterSpacing: ls(0.16, 10),
  textTransform: "uppercase",
  color: glass.text.fg70,
};

/** Underlined light meta link (tertiary on-photo action). */
export const authGlassLinkTextStyle: TextStyle = {
  fontFamily: APP_FONT_FAMILIES.sansRegular,
  fontSize: 12,
  color: glass.text.fg70,
  textDecorationLine: "underline",
};

/** Quiet supporting copy on the glass card. */
export const authGlassBodyStyle: TextStyle = {
  fontFamily: APP_FONT_FAMILIES.sansRegular,
  fontSize: 13,
  lineHeight: 19,
  color: glass.text.fg70,
};

/**
 * Shared auth-screen frame (refs 11b / 13a–13c): full-bleed photo backdrop
 * under the mobile vertical scrim, with a centered heavier-glass card
 * (overlay weight: 0.14 / blur 30 / border 0.22 + deep shadow).
 */
export function AuthGlassFrame({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow?: string;
  title?: string;
  /** Optional Ionicons glyph above the title (13b `mark_email_unread` parity). */
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop imageUrl={AUTH_BACKDROP_URI} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <GlassOverlay style={{ marginHorizontal: 16 }} surfaceStyle={{ padding: 22 }}>
            {eyebrow || title || icon ? (
              <View style={{ alignItems: "center", marginBottom: 28 }}>
                {icon ? (
                  <Ionicons
                    name={icon}
                    size={36}
                    color={glass.text.fg45}
                    style={{ marginBottom: 14 }}
                  />
                ) : null}
                {eyebrow ? (
                  <Text
                    style={{
                      marginBottom: 8,
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 10,
                      letterSpacing: ls(0.26, 10),
                      textTransform: "uppercase",
                      textAlign: "center",
                      color: glass.text.fg70,
                    }}
                  >
                    {eyebrow}
                  </Text>
                ) : null}
                {title ? (
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.displayItalic,
                      fontSize: 36,
                      lineHeight: 41,
                      textAlign: "center",
                      color: glass.text.fg,
                    }}
                  >
                    {title}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {children}
          </GlassOverlay>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Danger banner as on-glass tint (glass field wash + danger border/text). */
export function AuthGlassErrorBanner({ message }: { message: string }) {
  return (
    <View
      style={{
        borderWidth: borderWidth.hairline,
        borderColor: glass.text.danger,
        borderRadius: 10,
        backgroundColor: glass.surface.field,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansRegular,
          fontSize: 13,
          lineHeight: 18,
          color: glass.text.danger,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

/** Success/info banner using the done-chip tint. */
export function AuthGlassSuccessBanner({ message }: { message: string }) {
  return (
    <View
      style={{
        borderWidth: borderWidth.hairline,
        borderColor: glass.chip.done.fg,
        borderRadius: 10,
        backgroundColor: glass.chip.done.bg,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansRegular,
          fontSize: 13,
          lineHeight: 18,
          color: glass.chip.done.fg,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

/** "or" divider with hairline rules at the glass divider tint. */
export function AuthGlassDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: glass.border.default }} />
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 10,
          letterSpacing: ls(0.16, 10),
          textTransform: "uppercase",
          color: glass.text.fg55,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: glass.border.default }} />
    </View>
  );
}

type AuthButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  loading?: boolean;
  /** Leading adornment (brand glyph) rendered before the label. */
  leading?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Full-width solid-light primary — THE one primary per auth screen (QA-3). */
export function AuthGlassSolidButton({
  label,
  loading,
  leading,
  disabled,
  style,
  ...rest
}: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="active:opacity-80"
      style={[
        {
          width: "100%",
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          borderRadius: 999,
          backgroundColor: glass.surface.solid,
          paddingHorizontal: 22,
        },
        disabled ? { opacity: 0.4 } : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={glass.text.ink} />
      ) : (
        <>
          {leading}
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 10,
              letterSpacing: ls(0.18, 10),
              textTransform: "uppercase",
              color: glass.text.ink,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Full-width glass-outline pill — OAuth providers / secondary actions. */
export function AuthGlassOutlineButton({
  label,
  loading,
  leading,
  disabled,
  style,
  ...rest
}: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      className="active:opacity-80"
      style={[
        {
          width: "100%",
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: glass.border.strong,
          backgroundColor: glass.surface.bar,
          paddingHorizontal: 22,
        },
        disabled ? { opacity: 0.4 } : null,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={glass.text.fg} />
      ) : (
        <>
          {leading}
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 10,
              letterSpacing: ls(0.16, 10),
              textTransform: "uppercase",
              color: glass.text.fg,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Underlined light meta link with a ≥44pt target. */
export function AuthGlassLink({
  label,
  style,
  textStyle,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      className="active:opacity-80"
      style={[{ minHeight: 44, justifyContent: "center", alignSelf: "center" }, style]}
      {...rest}
    >
      <Text style={[authGlassLinkTextStyle, textStyle]}>{label}</Text>
    </Pressable>
  );
}
