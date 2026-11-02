import { test, expect } from "@playwright/test";
import { authReady, AUTH_SKIP_REASON, signInWithPassword } from "./fixtures";

/**
 * Export downloads a JSON bundle on /settings/data. Web edits save straight to the account
 * (ADR-0006) and backup-file restore is not offered on web; the page says so.
 * See docs/DATA_AND_SYNC.md §11.
 *
 * Gated: needs a signed-in user on a live Convex deployment.
 */
test.describe("web export, no file restore", () => {
  test.skip(!authReady(), AUTH_SKIP_REASON);

  test("exports a bundle and offers no file restore", async ({ page }) => {
    await signInWithPassword(page);
    await page.goto("/settings/data");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export/i }).click();
    const download = await downloadPromise;
    expect(await download.path()).toBeTruthy();

    await expect(page.getByTestId("import-unavailable")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});
