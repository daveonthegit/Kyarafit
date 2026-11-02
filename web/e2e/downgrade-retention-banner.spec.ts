import { test, expect } from "@playwright/test";
import { authReady, AUTH_SKIP_REASON, signInWithPassword } from "./fixtures";

/**
 * Downgrade cloud-retention banner visibility (REQ-D96/D97). A user who downgraded paid→free sees an
 * informational, non-blocking CloudRetentionBanner (src/components/CloudRetentionBanner.tsx) describing
 * their cloud-backup phase (grace / frozen / purgeable). A never-downgraded user sees no banner.
 *
 * Gated: the banner keys off `useTier().data.downgradedAt`, which requires an account that actually
 * downgraded on a live Convex deployment. The banner-content logic itself is already unit-tested
 * (src/components/CloudRetentionBanner.test.tsx); this E2E only proves it mounts on real screens for
 * a downgraded user. Set E2E_DOWNGRADED_USER=1 with such an account.
 */
test.describe("downgrade cloud-retention banner", () => {
  test.skip(
    !authReady() || !process.env.E2E_DOWNGRADED_USER,
    `${AUTH_SKIP_REASON} Additionally set E2E_DOWNGRADED_USER=1 with a downgraded (paid→free) account.`
  );

  test("a downgraded user sees the cloud-retention banner", async ({ page }) => {
    await signInWithPassword(page);
    await page.goto("/home");

    // The banner renders role="status" with a resubscribe/cloud-backup message.
    const banner = page.getByRole("status").filter({ hasText: /cloud backup/i });
    await expect(banner).toBeVisible();
  });
});
