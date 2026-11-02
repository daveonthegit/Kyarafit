import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Backend (Convex) test runner. Uses the edge-runtime environment + `convex-test` so queries and
 * mutations run against an in-memory Convex with real validators/indexes. Rooted at convex/ so it
 * only picks up backend tests (the web jsdom runner owns web/src).
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["**/*.test.ts"],
    globals: true,
  },
});
