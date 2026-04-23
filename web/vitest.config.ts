import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/** Hoisted workspace installs may not have `web/node_modules/react`; resolve from this package. */
const require = createRequire(import.meta.url);
function resolvePackageDir(specifier: string): string {
  return path.dirname(require.resolve(`${specifier}/package.json`));
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: resolvePackageDir("react"),
      "react-dom": resolvePackageDir("react-dom"),
      "convex/_generated/api": path.resolve(__dirname, "../convex/_generated/api.js"),
      "convex/_generated/server": path.resolve(__dirname, "../convex/_generated/server.js"),
      "convex/_generated/dataModel": path.resolve(__dirname, "../convex/_generated/dataModel.js"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
