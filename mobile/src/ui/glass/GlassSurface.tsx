import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { borderWidth } from "@kyarafit/design-system/rn";
import {
  ANDROID_BLUR_METHOD,
  GLASS_OVERLAY_SHADOW,
  GLASS_WEIGHTS,
  isGlassBlurSupported,
  type GlassWeight,
} from "./glassSurfaces";

type GlassSurfaceProps = {
  children?: ReactNode;
  /**
   * Set false to force the opaque fallback — required inside scrolling list
   * rows (blur is expensive) or when a surface shows jank on device.
   */
  blur?: boolean;
  style?: StyleProp<ViewStyle>;
};

function GlassSurface({
  weight,
  blur = true,
  style,
  children,
}: GlassSurfaceProps & { weight: GlassWeight }) {
  const recipe = GLASS_WEIGHTS[weight];
  const blurOn = blur && isGlassBlurSupported();

  return (
    <View
      style={[
        {
          borderRadius: recipe.radius,
          borderWidth: borderWidth.hairline,
          borderColor: recipe.border,
          overflow: "hidden",
          backgroundColor: blurOn ? "transparent" : recipe.fallback,
        },
        style,
      ]}
    >
      {blurOn ? (
        <BlurView
          intensity={recipe.intensity}
          tint="dark"
          experimentalBlurMethod={Platform.OS === "android" ? ANDROID_BLUR_METHOD : undefined}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {blurOn ? (
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
export function GlassOverlay({ style, ...props }: GlassSurfaceProps) {
  // Shadow lives on an unclipped wrapper: the rounded surface clips children
  // with overflow hidden, which would swallow its own shadow.
  return (
    <View style={[GLASS_OVERLAY_SHADOW, { borderRadius: GLASS_WEIGHTS.overlay.radius }, style]}>
      <GlassSurface weight="overlay" {...props} />
    </View>
  );
}
