import { test, expect } from "@playwright/test";
import { authReady, AUTH_SKIP_REASON, signInWithPassword } from "./fixtures";

/**
 * Export downloads a JSON bundle on /settings/data. Web shows published copies only (ADR-0005), so
 * restore is done in the mobile app and the page says so instead of offering it.
 * See docs/DATA_AND_SYNC.md §11.
 *
 * Gated: needs a signed-in user on a live Convex deployment.
 */
test.describe("web export and read-only restore", () => {
  test.skip(!authReady(), AUTH_SKIP_REASON);

  test("exports a bundle and points restore to the mobile app", async ({ page }) => {
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
