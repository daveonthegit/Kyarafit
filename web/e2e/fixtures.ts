import { type Page, expect } from "@playwright/test";

/**
 * Shared E2E helpers + the env gate for auth/paid-state flows.
 *
 * Most critical-path flows (build/convention CRUD, export/import with real rows, backfill, downgrade
 * banner) need a SIGNED-IN user backed by a live Convex deployment. That state cannot be faked in
 * this repo without a backend, so those specs gate on `authReady()` and `skip()` with a clear reason
 * when the required env is absent — rather than a fake pass. Provide either:
 *
 *   E2E_USER_EMAIL + E2E_USER_PASSWORD   → sign in through the real /auth/signin form, or
 *   E2E_STORAGE_STATE=/path/state.json   → a pre-authenticated Playwright storage state file.
 *
 * See docs/TESTING.md for how to produce these against a Convex dev deployment.
 */
export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL;
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD;
export const E2E_STORAGE_STATE = process.env.E2E_STORAGE_STATE;

/** True when credentials (or a saved session) are available to reach authed surfaces. */
export function authReady(): boolean {
  return Boolean((E2E_USER_EMAIL && E2E_USER_PASSWORD) || E2E_STORAGE_STATE);
}

/** Human-readable reason used in `test.skip(...)` so a skipped run explains itself. */
export const AUTH_SKIP_REASON =
  "Requires a signed-in user on a live Convex deployment. Set E2E_USER_EMAIL + E2E_USER_PASSWORD " +
  "(or E2E_STORAGE_STATE). See docs/TESTING.md.";

/**
 * Sign in through the real email/password form and land on /home. Selectors mirror
 * src/app/auth/signin/page.tsx. Only call when `authReady()` and credentials (not just a storage
 * state) are present.
 */
export async function signInWithPassword(page: Page): Promise<void> {
  if (!E2E_USER_EMAIL || !E2E_USER_PASSWORD) {
    throw new Error("signInWithPassword requires E2E_USER_EMAIL and E2E_USER_PASSWORD");
  }
  await page.goto("/auth/signin");
  await page.getByPlaceholder("you@example.com").fill(E2E_USER_EMAIL);
  await page.getByPlaceholder("••••••••").fill(E2E_USER_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/home/, { timeout: 15_000 });
}

/** Toggle the browser's online/offline state (drives the app's `navigator.onLine` handling). */
export async function setOffline(page: Page, offline: boolean): Promise<void> {
  await page.context().setOffline(offline);
}

export { expect };
