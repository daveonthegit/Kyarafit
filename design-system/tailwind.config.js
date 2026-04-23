const { makeSharedThemeExtension } = require("./tailwind.shared");

const shared = makeSharedThemeExtension({ includeDarkAliases: true });

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      ...shared,
      fontFamily: {
        ...shared.fontFamily,
        sans: ["AlbertSans_500Medium"],
        serif: ["BodoniModa_400Regular_Italic"],
        "serif-elegant": ["BodoniModa_400Regular_Italic"],
        "sans-wide": ["AlbertSans_700Bold"],
      },
    },
  },
  plugins: [],
};
