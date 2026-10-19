import { test, expect } from "@playwright/test";
import { authReady, AUTH_SKIP_REASON, signInWithPassword } from "./fixtures";

/**
 * Export downloads a JSON bundle on /settings/data. Restore requires an empty vault and an
 * internet connection; interrupted restores must be undone rather than resumed.
 * See docs/DATA_AND_SYNC.md §11 for the web restore contract.
 *
 * Gated: needs a signed-in user with personal data on a live Convex deployment.
 */
test.describe("export and non-empty vault restore refusal", () => {
  test.skip(!authReady(), AUTH_SKIP_REASON);

  test("re-importing into the same non-empty account is refused", async ({ page }) => {
    await signInWithPassword(page);
    await page.goto("/settings/data");

    // Export: clicking the export button triggers a client-side download.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export/i }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();

    // Import the just-exported bundle back in via the hidden file input.
    await page.getByTestId("import-file-input").setInputFiles(path!);

    await expect(page.getByTestId("import-error")).toBeVisible();
    await expect(page.getByTestId("import-error")).toHaveText(
      "Restore requires an empty vault. Export your current data first, then remove it before restoring."
    );
    await expect(page.getByTestId("import-summary")).not.toBeVisible();
    await expect(page.getByTestId("import-incomplete")).not.toBeVisible();
  });
});
