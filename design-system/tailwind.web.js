const { makeSharedThemeExtension } = require("./tailwind.shared");

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: makeSharedThemeExtension({ withCssVariables: true }),
  },
  plugins: [],
};
