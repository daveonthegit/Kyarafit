const designTokens = require("./design_tokens.json");

const { typography, radius, shadow, themes } = designTokens;

const light = themes.light.color;
const dark = themes.dark.color;

function makeFontFamilies({ withCssVariables = false } = {}) {
  const prepend = (fonts, cssVariable) =>
    withCssVariables && cssVariable ? [cssVariable, ...fonts] : fonts;

  return {
    sans: prepend(typography.fontFamily.sans, "var(--font-body)"),
    serif: prepend(typography.fontFamily.serifDisplay, "var(--font-display)"),
    "serif-elegant": prepend(typography.fontFamily.serifElegant, "var(--font-display)"),
    "sans-wide": prepend(typography.fontFamily.sansWide, "var(--font-body)"),
    "explorer-mono": prepend(typography.fontFamily.mono, "var(--font-explorer-mono)"),
  };
}

function makeSharedThemeExtension({ withCssVariables = false, includeDarkAliases = false } = {}) {
  const colors = withCssVariables
    ? {
        kyar: {
          bg: "oklch(var(--kyar-bg) / <alpha-value>)",
          bgWarm: "oklch(var(--kyar-bg-warm) / <alpha-value>)",
          surface: "oklch(var(--kyar-surface) / <alpha-value>)",
          surfaceWarm: "oklch(var(--kyar-surface-warm) / <alpha-value>)",
          card: "oklch(var(--kyar-surface) / <alpha-value>)",
          muted: "oklch(var(--kyar-muted) / <alpha-value>)",
          mutedWarm: "oklch(var(--kyar-muted-warm) / <alpha-value>)",
          panel: "oklch(var(--kyar-panel) / <alpha-value>)",
          panelRaised: "oklch(var(--kyar-panel-raised) / <alpha-value>)",
          overlay: "oklch(var(--kyar-bg) / <alpha-value>)",
          text: "oklch(var(--kyar-text) / <alpha-value>)",
          textSecondary: "oklch(var(--kyar-text-secondary) / <alpha-value>)",
          textTertiary: "oklch(var(--kyar-text-tertiary) / <alpha-value>)",
          textMuted: "oklch(var(--kyar-text-muted) / <alpha-value>)",
          meta: "oklch(var(--kyar-meta) / <alpha-value>)",
          border: "oklch(var(--kyar-border) / <alpha-value>)",
          borderSubtle: "oklch(var(--kyar-border-subtle) / <alpha-value>)",
          cardBorder: "oklch(var(--kyar-card-border) / <alpha-value>)",
          accent: "oklch(var(--kyar-accent) / <alpha-value>)",
          accentSoft: "oklch(var(--kyar-accent-soft) / <alpha-value>)",
          danger: "oklch(var(--kyar-danger) / <alpha-value>)",
        },
      }
    : {
        kyar: {
          bg: light.background.base,
          bgWarm: light.background.warm,
          surface: light.background.surface,
          surfaceWarm: light.background.surfaceWarm,
          card: light.background.surface,
          muted: light.background.muted,
          mutedWarm: light.background.mutedWarm,
          panel: light.background.panel,
          panelRaised: light.background.panelRaised,
          overlay: light.background.overlay,
          text: light.text.primary,
          textSecondary: light.text.secondary,
          textTertiary: light.text.tertiary,
          textMuted: light.text.muted,
          meta: light.text.meta,
          border: light.border.default,
          borderSubtle: light.border.subtle,
          cardBorder: light.border.card,
          accent: light.accent.primary,
          accentSoft: light.accent.soft,
          danger: light.state.danger,
          ...(includeDarkAliases
            ? {
                dark: {
                  bg: dark.background.base,
                  bgWarm: dark.background.warm,
                  surface: dark.background.surface,
                  surfaceWarm: dark.background.surfaceWarm,
                  card: dark.background.surface,
                  muted: dark.background.muted,
                  mutedWarm: dark.background.mutedWarm,
                  panel: dark.background.panel,
                  panelRaised: dark.background.panelRaised,
                  overlay: dark.background.overlay,
                  text: dark.text.primary,
                  textSecondary: dark.text.secondary,
                  textTertiary: dark.text.tertiary,
                  textMuted: dark.text.muted,
                  meta: dark.text.meta,
                  border: dark.border.default,
                  borderSubtle: dark.border.subtle,
                  cardBorder: dark.border.card,
                  accent: dark.accent.primary,
                  accentSoft: dark.accent.soft,
                  danger: dark.state.danger,
                },
              }
            : {}),
        },
      };

  return {
    colors,
    fontFamily: makeFontFamilies({ withCssVariables }),
    letterSpacing: typography.tracking,
    borderRadius: {
      sm: `${radius.sm}px`,
      DEFAULT: `${radius.base}px`,
      md: `${radius.md}px`,
      lg: `${radius.lg}px`,
      xl: `${radius.xl}px`,
    },
    boxShadow: withCssVariables
      ? {
          soft: "0 28px 60px -32px oklch(var(--kyar-shadow) / 0.2), 0 14px 28px -24px oklch(var(--kyar-shadow) / 0.12)",
          card: "0 18px 40px -28px oklch(var(--kyar-shadow) / 0.18), 0 8px 18px -16px oklch(var(--kyar-shadow) / 0.1)",
          fab: "0 18px 36px -18px oklch(var(--kyar-shadow) / 0.26), 0 8px 16px -10px oklch(var(--kyar-shadow) / 0.18)",
        }
      : {
          soft: shadow.soft,
          card: shadow.card,
          fab: shadow.fab,
        },
  };
}

module.exports = {
  designTokens,
  makeSharedThemeExtension,
};
