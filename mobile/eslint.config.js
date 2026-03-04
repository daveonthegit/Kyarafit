// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
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
];
