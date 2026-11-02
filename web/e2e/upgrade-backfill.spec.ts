import { test, expect } from "@playwright/test";
import { authReady, AUTH_SKIP_REASON, signInWithPassword } from "./fixtures";

/**
 * Upgrade backfill progress surfacing (REQ-D95). After a FREE→paid upgrade with existing local rows,
 * a one-time "Backing up your library… N/M" indicator appears in the global SyncStatus pill
 * (src/components/SyncStatus.tsx) while the backfill runs.
 *
 * Gated + intentionally SHALLOW: reliably reaching this state needs (a) a paid entitlement and
 * (b) a fresh upgrade with a non-empty local library and a running sync worker — i.e. a scripted
 * RevenueCat/tier fixture on a live backend. Documented here so the env owner can complete it; the
 * assertion targets the real backfill string once that state is set up.
 */
test.describe("upgrade backfill progress", () => {
  test.skip(
    !authReady() || !process.env.E2E_PAID_BACKFILL,
    `${AUTH_SKIP_REASON} Additionally set E2E_PAID_BACKFILL=1 with a paid account mid-backfill.`
  );

  test("backfill indicator surfaces while backing up the library", async ({ page }) => {
    await signInWithPassword(page);
    await page.goto("/home");

    // SyncStatus renders role="status"; while backfill.running it shows "Backing up your library…".
    const syncPill = page.getByRole("status").filter({ hasText: /backing up/i });
    await expect(syncPill).toBeVisible();
  });
});
