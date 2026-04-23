import { colorThemes } from "@kyarafit/design-system/rn";

/**
 * Text and chrome on portfolio/event posters use a bottom gradient scrim that
 * darkens the image. Foreground should stay light regardless of app light/dark
 * theme — `colors.bg` in dark mode matches the scrim and becomes unreadable.
 */
export const mediaOverlay = {
  primary: colorThemes.light.surface,
  secondary: "rgba(255, 253, 248, 0.78)",
  tertiary: "rgba(255, 253, 248, 0.62)",
  muted: "rgba(255, 253, 248, 0.45)",
  ring: "rgba(255, 253, 248, 0.35)",
} as const;

/** Subtle shadow so titles stay legible on busy or bright image areas. */
export const mediaOverlayTitleShadow = {
  textShadowColor: "rgba(0, 0, 0, 0.55)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
} as const;
