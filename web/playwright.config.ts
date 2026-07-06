import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright web E2E configuration (Phase 8 harness).
 *
 * Requires a RUNNING app to test against — Playwright does not stub Convex or better-auth. Point it
 * at a live target with `E2E_BASE_URL` (defaults to the local `next dev` port). See docs/TESTING.md
 * for the full local + CI runbook (Convex dev deployment, `npx playwright install`, auth fixtures).
 *
 * The `webServer` block is OPT-IN via `E2E_WEBSERVER=1`: it only auto-starts `next dev` when you ask
 * it to, because the dev server needs `NEXT_PUBLIC_CONVEX_URL` + a Convex deployment to be useful.
 * Without it, run your own server (or target a preview URL) and just set `E2E_BASE_URL`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const useWebServer = process.env.E2E_WEBSERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: useWebServer
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
