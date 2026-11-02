import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import {
  ANDROID_BLUR_METHOD,
  GLASS_OVERLAY_SHADOW,
  GLASS_WEIGHTS,
  isGlassBlurSupported,
  scrimGradientProps,
  type GlassWeight,
} from "./glassSurfaces";

type GlassSurfaceProps = {
  children?: ReactNode;
  /**
   * Set false to force the opaque fallback — required inside scrolling list
   * rows (blur is expensive) or when a surface shows jank on device.
   */
  blur?: boolean;
  /**
   * Transitional chrome (web `.bg-glass-*-on-wall`): glass wash over the
   * studio-wall gradient instead of blurring live content. Use for chrome
   * that sits over not-yet-converted (cream) screens.
   */
  onWall?: boolean;
  style?: StyleProp<ViewStyle>;
};

function GlassSurface({
  weight,
  blur = true,
  onWall = false,
  style,
  children,
}: GlassSurfaceProps & { weight: GlassWeight }) {
  const recipe = GLASS_WEIGHTS[weight];
  const blurOn = !onWall && blur && isGlassBlurSupported();

  return (
    <View
      // Flattened: expo-router's <Slot> rejects array styles on its children.
      style={StyleSheet.flatten([
        {
          borderRadius: recipe.radius,
          borderWidth: borderWidth.hairline,
          borderColor: recipe.border,
          overflow: "hidden",
          backgroundColor: blurOn || onWall ? "transparent" : recipe.fallback,
        },
        style,
      ])}
    >
      {onWall ? (
        <LinearGradient
          {...scrimGradientProps(glass.scrim.studioWall)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {blurOn ? (
        <BlurView
          intensity={recipe.intensity}
          tint="dark"
          experimentalBlurMethod={Platform.OS === "android" ? ANDROID_BLUR_METHOD : undefined}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {blurOn || onWall ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: recipe.surface }]}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
}

/** Panel weight (0.10 / blur 24 / radius 14) — the ONE work panel per region. */
export function GlassPanel(props: GlassSurfaceProps) {
  return <GlassSurface weight="panel" {...props} />;
}

/** Bar weight (0.08 / blur 18, edge-to-edge) — tab bar, top bars, strips. */
export function GlassBar(props: GlassSurfaceProps) {
  return <GlassSurface weight="bar" {...props} />;
}

/** Overlay weight (0.14 / blur 30 / radius 16 + deep shadow) — sheets, dialogs. */
export function GlassOverlay({
  style,
  surfaceStyle,
  ...props
}: GlassSurfaceProps & { surfaceStyle?: StyleProp<ViewStyle> }) {
  // Shadow lives on an unclipped wrapper: the rounded surface clips children
  // with overflow hidden, which would swallow its own shadow.
  return (
    <View
      style={StyleSheet.flatten([
        GLASS_OVERLAY_SHADOW,
        { borderRadius: GLASS_WEIGHTS.overlay.radius },
        style,
      ])}
    >
      <GlassSurface weight="overlay" style={surfaceStyle} {...props} />
    </View>
  );
}
