/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), require("@kyarafit/design-system/tailwind")],
  theme: {
    extend: {},
  },
  plugins: [],
};
