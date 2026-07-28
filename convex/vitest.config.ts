import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Backend tests run against `convex-test`, an in-memory implementation of the
 * Convex runtime, so they need the edge-runtime environment rather than jsdom.
 * Scoped to `convex/` so the web suite (jsdom) is not pulled in.
 */
export default defineConfig({
  root: path.resolve(import.meta.dirname, ".."),
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
