// Kyarafit React Native Token Map (token-aligned)
export const colors = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  muted: "#F9F9F9",
  text: "#000000",
  textSecondary: "rgba(0,0,0,0.60)",
  textTertiary: "rgba(0,0,0,0.40)",
  textMuted: "rgba(0,0,0,0.30)",
  meta: "rgba(0,0,0,0.50)",
  border: "rgba(0,0,0,0.10)",
  borderSubtle: "rgba(0,0,0,0.05)",
  borderStrong: "#000000",
  accent: "#1152D4",
  danger: "rgba(239,68,68,0.80)"
} as const;

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64
} as const;

export const layout = {
  screenPaddingX: 24,
  screenPaddingXWide: 32,
  sectionGap: 48,
  stackGap: 24,
  gridGap: 12
} as const;

export const radius = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 12
} as const;

export const borderWidth = {
  hairline: 0.5,
  thin: 1,
  thick: 2
} as const;

export const shadow = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 20 },
    elevation: 1
  },
  fab: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  }
} as const;

// Font roles (use expo-font to load Inter / Playfair / Bodoni / Montserrat)
export const font = {
  family: {
    sans: "Inter",
    serifDisplay: "PlayfairDisplay",
    serifElegant: "BodoniModa",
    sansWide: "Montserrat"
  },
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48
  },
  tracking: {
    meta: 0.2,
    wide: 0.25,
    wider: 0.3,
    widest: 0.4
  }
} as const;

/**
 * Helper: approximate CSS letter-spacing in RN.
 * RN letterSpacing is in "pixels", not "em".
 * Multiply em by fontSize to get px.
 */
export function ls(em: number, fontSize: number) {
  return em * fontSize;
}
