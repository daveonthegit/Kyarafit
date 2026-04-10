/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ["var(--font-body)", "Albert Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "Bodoni Moda", "Georgia", "serif"],
        "serif-elegant": ["var(--font-display)", "Bodoni Moda", "Georgia", "serif"],
        "sans-wide": ["var(--font-body)", "Albert Sans", "system-ui", "sans-serif"],
        "explorer-mono": ["var(--font-explorer-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        meta: "0.16em",
        wide: "0.18em",
        wider: "0.24em",
        widest: "0.32em",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "14px",
        lg: "18px",
        xl: "28px",
      },
      boxShadow: {
        soft: "0 28px 60px -32px oklch(var(--kyar-shadow) / 0.2), 0 14px 28px -24px oklch(var(--kyar-shadow) / 0.12)",
        card: "0 18px 40px -28px oklch(var(--kyar-shadow) / 0.18), 0 8px 18px -16px oklch(var(--kyar-shadow) / 0.1)",
        fab: "0 18px 36px -18px oklch(var(--kyar-shadow) / 0.26), 0 8px 16px -10px oklch(var(--kyar-shadow) / 0.18)",
      },
    },
  },
  plugins: [],
};
