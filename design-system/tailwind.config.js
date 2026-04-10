// Kyarafit Tailwind Config (foundation-aligned)
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kyar: {
          bg: "#F7F3EB",
          bgWarm: "#EFE9DE",
          surface: "#FFFDF8",
          surfaceWarm: "#F8F2E8",
          card: "#FFFDF8",
          muted: "#ECE7DE",
          mutedWarm: "#E4DDD2",
          text: "#171629",
          textSecondary: "rgba(23,22,41,0.72)",
          textTertiary: "rgba(23,22,41,0.52)",
          textMuted: "rgba(23,22,41,0.36)",
          meta: "rgba(23,22,41,0.60)",
          border: "rgba(23,22,41,0.14)",
          borderSubtle: "rgba(23,22,41,0.08)",
          cardBorder: "rgba(23,22,41,0.16)",
          accent: "#3B56D6",
          accentSoft: "rgba(59,86,214,0.12)",
          danger: "#D1495B",
        },
      },
      fontFamily: {
        sans: ["Albert Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["Bodoni Moda", "Georgia", "serif"],
        "serif-elegant": ["Bodoni Moda", "Georgia", "serif"],
        "sans-wide": ["Albert Sans", "system-ui", "sans-serif"],
        "explorer-mono": ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
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
        soft: "0 28px 60px -32px rgba(23,22,41,0.20)",
        card: "0 18px 40px -28px rgba(23,22,41,0.18)",
        fab: "0 18px 36px -18px rgba(23,22,41,0.26)",
      },
    },
  },
  plugins: [],
};
