import { Platform } from "react-native";
import { glass, type GlassScrim } from "@kyarafit/design-system/rn";

/**
 * Glass Studio surface recipes (surface rule 15 / QA-6): exactly three
 * weights — bar 0.08/blur 18 · panel 0.10/24 · overlay 0.14/30 — never mixed.
 * The blur-vs-opaque-fallback decision lives here so screens never care.
 */
export type GlassWeight = "bar" | "panel" | "overlay";

export const GLASS_WEIGHTS: Record<
  GlassWeight,
  {
    surface: string;
    border: string;
    radius: number;
    /** expo-blur intensity (0–100) approximating the CSS blur radius. */
    intensity: number;
    fallback: string;
  }
> = {
  bar: {
    surface: glass.surface.bar,
    border: glass.border.default,
    radius: 0,
    intensity: glass.blur.bar * 2,
    fallback: glass.fallback.bar,
  },
  panel: {
    surface: glass.surface.panel,
    border: glass.border.default,
    radius: glass.radius.panel,
    intensity: glass.blur.panel * 2,
    fallback: glass.fallback.panel,
  },
  overlay: {
    surface: glass.surface.overlay,
    border: glass.border.overlay,
    radius: glass.radius.overlay,
    intensity: glass.blur.overlay * 2,
    fallback: glass.fallback.overlay,
  },
};

/**
 * Android BlurView needs the experimental renderer; where it misbehaves on a
 * given surface, callers pass `blur={false}` and get the opaque fallback —
 * the spec explicitly allows dropping a janky surface to its fallback.
 */
export const ANDROID_BLUR_METHOD = "dimezisBlurView" as const;

export function isGlassBlurSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** `--glass-shadow-overlay` (0 40px 100px rgba(0,0,0,0.55)) as RN shadow. */
export const GLASS_OVERLAY_SHADOW = {
  shadowColor: "#000000",
  shadowOpacity: 0.55,
  shadowRadius: 50,
  shadowOffset: { width: 0, height: 40 },
  elevation: 24,
} as const;

type GradientPoint = { x: number; y: number };

const DIRECTION_POINTS: Record<string, { start: GradientPoint; end: GradientPoint }> = {
  "to right": { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  "to top": { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  "180deg": { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
};

/**
 * Converts a structured scrim token (`glass.scrim.*` — `{direction, stops[]}`)
 * into expo-linear-gradient props.
 */
export function scrimGradientProps(scrim: GlassScrim) {
  const points = DIRECTION_POINTS[scrim.direction] ?? DIRECTION_POINTS["180deg"];
  return {
    colors: scrim.stops.map((stop) => stop.color) as [string, string, ...string[]],
    locations: scrim.stops.map((stop) => stop.at) as [number, number, ...number[]],
    start: points.start,
    end: points.end,
  };
}
