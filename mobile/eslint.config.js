// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");
const requireDataBoundary = require("./eslint-rules/require-data-boundary.cjs");
const requireDesignSystemColors = require("./eslint-rules/require-design-system-colors.cjs");
const noDirectConvexInOfflineCore = require("./eslint-rules/no-direct-convex-in-offline-core.cjs");

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
          "no-direct-convex-in-offline-core": noDirectConvexInOfflineCore,
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
  {
    files: [
      "src/screens/build-detail/**/*.tsx",
      "src/screens/conventions/**/*.tsx",
      "app/(app)/(tabs)/builds.tsx",
      "app/(app)/(tabs)/elements.tsx",
      "app/(app)/(tabs)/planner.tsx",
      "app/(app)/conventions/**/*.tsx",
      "app/(app)/packing.tsx",
      "app/(app)/itinerary.tsx",
    ],
    rules: {
      "kyarafit/no-direct-convex-in-offline-core": "error",
    },
  },
];
