import designTokens from "./design_tokens.json";

type ThemeName = keyof typeof designTokens.themes;

const pxUnit = designTokens.spacing.unitPx;

function trackToEm(value: string): number {
  return Number(value.replace("em", ""));
}

function mapTheme(themeName: ThemeName) {
  const theme = designTokens.themes[themeName].color;

  return {
    bg: theme.background.base,
    bgWarm: theme.background.warm,
    surface: theme.background.surface,
    surfaceWarm: theme.background.surfaceWarm,
    card: theme.background.surface,
    muted: theme.background.muted,
    mutedWarm: theme.background.mutedWarm,
    panel: theme.background.panel,
    panelRaised: theme.background.panelRaised,
    overlay: theme.background.overlay,
    text: theme.text.primary,
    textSecondary: theme.text.secondary,
    textTertiary: theme.text.tertiary,
    textMuted: theme.text.muted,
    meta: theme.text.meta,
    border: theme.border.default,
    borderSubtle: theme.border.subtle,
    cardBorder: theme.border.card,
    borderStrong: theme.border.strong,
    accent: theme.accent.primary,
    accentSoft: theme.accent.soft,
    danger: theme.state.danger,
  } as const;
}

export const colorThemes = {
  light: mapTheme("light"),
  dark: mapTheme("dark"),
} as const;

export type DesignThemeName = keyof typeof colorThemes;
export type DesignColors = (typeof colorThemes)[DesignThemeName];

export const colors = colorThemes.light;

export function getColors(theme: DesignThemeName = "light"): DesignColors {
  return colorThemes[theme];
}

export const spacing = {
  0: 0,
  0.5: pxUnit * 0.5,
  1: pxUnit,
  2: pxUnit * 2,
  3: pxUnit * 3,
  4: pxUnit * 4,
  5: pxUnit * 5,
  6: pxUnit * 6,
  8: pxUnit * 8,
  10: pxUnit * 10,
  12: pxUnit * 12,
  14: pxUnit * 14,
  16: pxUnit * 16,
  24: pxUnit * 24,
} as const;

export const layout = {
  screenPaddingX: designTokens.spacing.layout.screenPaddingX,
  screenPaddingXWide: designTokens.spacing.layout.screenPaddingXWide,
  sectionGap: designTokens.spacing.layout.sectionGap,
  stackGap: designTokens.spacing.layout.stackGap,
  gridGap: designTokens.spacing.layout.gridGap,
} as const;

export const radius = {
  none: designTokens.radius.none,
  sm: designTokens.radius.sm,
  base: designTokens.radius.base,
  md: designTokens.radius.md,
  lg: designTokens.radius.lg,
  xl: designTokens.radius.xl,
} as const;

export const borderWidth = {
  hairline: designTokens.borderWidth.hairline,
  thin: designTokens.borderWidth.thin,
  thick: designTokens.borderWidth.thick,
} as const;

export const shadow = {
  soft: {
    shadowColor: colorThemes.light.text,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
  card: {
    shadowColor: colorThemes.light.text,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  fab: {
    shadowColor: colorThemes.light.text,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
} as const;

export const font = {
  family: {
    sans: "AlbertSans_500Medium",
    serifDisplay: "BodoniModa_400Regular_Italic",
    serifElegant: "BodoniModa_400Regular_Italic",
    sansWide: "AlbertSans_700Bold",
    mono: "Courier",
  },
  role: designTokens.typography.roles,
  size: designTokens.typography.fontSize,
  tracking: {
    meta: trackToEm(designTokens.typography.tracking.meta),
    wide: trackToEm(designTokens.typography.tracking.wide),
    wider: trackToEm(designTokens.typography.tracking.wider),
    widest: trackToEm(designTokens.typography.tracking.widest),
  },
} as const;

export const motion = designTokens.motion;

/**
 * Glass Studio (v2) tokens — light-on-photo surfaces shared by web + mobile.
 * These never theme-flip: glass always sits on photography or the studio wall.
 * Mobile renders `surface`/`border` over expo-blur (`blur` values), and falls
 * back to `fallback` opaque panels where blur is unavailable.
 */
export const glass = {
  surface: designTokens.glass.surface,
  border: designTokens.glass.border,
  text: designTokens.glass.text,
  chip: designTokens.glass.chip,
  blur: designTokens.glass.blur,
  radius: designTokens.glass.radius,
  scrim: {
    ...designTokens.glass.scrim,
    // RN color parsing has no oklch(); studioWall swaps to pre-converted hex stops.
    studioWall: designTokens.glass.scrim.studioWallRn,
  },
  drop: designTokens.glass.drop,
  shadow: designTokens.glass.shadow,
  fallback: designTokens.glass.fallback,
  scrimDim: designTokens.glass.scrimDim,
  statusCutout: designTokens.glass.statusCutout,
} as const;

export type GlassScrim = (typeof glass.scrim)[keyof typeof glass.scrim];
export type GlassChipTone = keyof typeof glass.chip;

export function ls(em: number, fontSize: number) {
  return em * fontSize;
}
