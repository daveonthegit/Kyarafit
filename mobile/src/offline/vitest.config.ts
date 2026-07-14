import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Scoped vitest runner for the mobile React layer (offline-sync unit tests + build-detail screen
 * component tests).
 *
 * The mobile workspace has no standalone React test runner (its `npm test` script only exercises
 * the eslint-rule fixtures), so this config lets these tests run under the same vitest + jsdom +
 * @vitejs/plugin-react stack already hoisted for web/convex. It is wired into `npm test -w mobile`
 * via the `test:offline` script. Run it directly with:
 *   npx vitest run --config mobile/src/offline/vitest.config.ts
 *
 * The `include` glob covers `src/offline/**`, `src/screens/**`, `src/lib/**`, and `src/components/**`
 * so React component tests (which RN cannot run under its default Metro/Jest-less setup) and pure
 * lib tests (e.g. the data export/import orchestration) execute here with mocked native modules.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, "../../");
const repoRoot = path.resolve(here, "../../../");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(mobileRoot, "src"),
      // expo-blur/expo-linear-gradient ship untranspiled JSX that vite can't
      // parse; tests only need passthrough views.
      "expo-blur": path.resolve(mobileRoot, "src/test-support/expoBlurStub.tsx"),
      "expo-linear-gradient": path.resolve(
        mobileRoot,
        "src/test-support/expoLinearGradientStub.tsx"
      ),
      "@expo/vector-icons/MaterialIcons": path.resolve(
        mobileRoot,
        "src/test-support/expoVectorIconsStub.tsx"
      ),
      "@expo/vector-icons": path.resolve(
        mobileRoot,
        "src/test-support/expoVectorIconsStub.tsx"
      ),
      // Imports real react-native (Flow syntax) outside the per-test vi.mock.
      "react-native-safe-area-context": path.resolve(
        mobileRoot,
        "src/test-support/safeAreaContextStub.tsx"
      ),
      "convex/_generated/api": path.resolve(repoRoot, "convex/_generated/api.js"),
      "convex/_generated/dataModel": path.resolve(repoRoot, "convex/_generated/dataModel.js"),
      "convex/_generated/server": path.resolve(repoRoot, "convex/_generated/server.js"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    root: mobileRoot,
    include: [
      "src/offline/**/*.test.{ts,tsx}",
      "src/screens/**/*.test.{ts,tsx}",
      "src/lib/**/*.test.{ts,tsx}",
      "src/components/**/*.test.{ts,tsx}",
    ],
  },
});
