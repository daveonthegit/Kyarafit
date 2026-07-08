/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  presets: [require("@kyarafit/design-system/tailwind-web")],
  theme: {
    extend: {
      colors: {
        "kyar-media-fg": "var(--kyar-media-fg)",
        "kyar-media-fg-muted": "var(--kyar-media-fg-muted)",
        "kyar-media-fg-soft": "var(--kyar-media-fg-soft)",
        "kyar-media-fg-subtle": "var(--kyar-media-fg-subtle)",
        "kyar-media-ring": "var(--kyar-media-ring)",
        glass: {
          DEFAULT: "var(--glass-bg)",
          bar: "var(--glass-bg-bar)",
          overlay: "var(--glass-bg-overlay)",
          active: "var(--glass-bg-active)",
          preview: "var(--glass-bg-preview)",
          solid: "var(--glass-bg-solid)",
          ink: "var(--glass-ink)",
          border: "var(--glass-border)",
          "border-overlay": "var(--glass-border-overlay)",
          "border-strong": "var(--glass-border-strong)",
          divider: "var(--glass-divider)",
          "divider-strong": "var(--glass-divider-strong)",
        },
        "media-fg-55": "var(--media-fg-55)",
        "media-fg-70": "var(--media-fg-70)",
        "media-fg-45": "var(--media-fg-45)",
        "on-glass-danger": "var(--on-glass-danger)",
        "on-glass-chip": {
          "done-bg": "var(--on-glass-chip-done-bg)",
          "done-fg": "var(--on-glass-chip-done-fg)",
          "active-bg": "var(--on-glass-chip-active-bg)",
          "active-fg": "var(--on-glass-chip-active-fg)",
          "warn-bg": "var(--on-glass-chip-warn-bg)",
          "warn-fg": "var(--on-glass-chip-warn-fg)",
          "neutral-bg": "var(--on-glass-chip-neutral-bg)",
          "neutral-fg": "var(--on-glass-chip-neutral-fg)",
        },
      },
      backdropBlur: {
        glass: "var(--glass-blur)",
        "glass-bar": "var(--glass-blur-bar)",
        "glass-overlay": "var(--glass-blur-overlay)",
        "glass-chip": "var(--glass-blur-chip)",
      },
      borderRadius: {
        glass: "var(--glass-radius)",
        "glass-overlay": "var(--glass-radius-overlay)",
        "glass-sheet": "var(--glass-radius-sheet)",
      },
      boxShadow: {
        "glass-overlay": "var(--glass-shadow-overlay)",
      },
    },
  },
  plugins: [],
};
