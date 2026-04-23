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
      },
    },
  },
  plugins: [],
};
