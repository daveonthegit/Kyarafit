// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");
const requireDataBoundary = require("./eslint-rules/require-data-boundary.cjs");
const requireDesignSystemColors = require("./eslint-rules/require-design-system-colors.cjs");

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
          "require-design-system-colors": requireDesignSystemColors,
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
  {
    files: [
      "src/ui/**/*.tsx",
      "src/components/auth/**/*.tsx",
      "src/components/ConnectivityBanner.tsx",
      "src/components/ErrorBoundary.tsx",
      "app/index.tsx",
      "app/(auth)/**/*.tsx",
      "app/(app)/(tabs)/more.tsx",
      "app/(app)/settings/appearance.tsx",
    ],
    rules: {
      "kyarafit/require-design-system-colors": "error",
    },
  },
];
