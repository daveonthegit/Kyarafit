// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");
const requireDataBoundary = require("./eslint-rules/require-data-boundary.cjs");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    plugins: {
      kyarafit: {
        rules: {
          "require-data-boundary": requireDataBoundary,
        },
      },
    },
    rules: {
      // Guardrail: mobile must not import from the web app (keeps platforms independent).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "kyarafit-web",
            "**/web/**",
            "../web",
            "../web/**",
            "../../web",
            "../../web/**",
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.tsx"],
    ignores: ["app/_layout.tsx", "**/app/**/_layout.tsx"],
    rules: {
      "kyarafit/require-data-boundary": "error",
    },
  },
];
