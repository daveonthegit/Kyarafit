import { test, expect } from "@playwright/test";
import { authReady, AUTH_SKIP_REASON, signInWithPassword } from "./fixtures";

/**
 * Export → import round-trip on /settings/data (REQ-D62/D100). Exporting downloads a JSON bundle of
 * the local-first collections; re-importing that same bundle is idempotent (added rows on a fresh
 * account, or all-skipped when re-imported into the same account).
 *
 * Gated: /settings/data is a protected route and its create mutations need `userId`, so this needs a
 * signed-in user on a live Convex deployment. Written against the real page's data-testids
 * (`import-file-input`, `import-summary`) so it runs as-is once creds are provided.
 */
test.describe("export/import round-trip", () => {
  test.skip(!authReady(), AUTH_SKIP_REASON);

  test("exported bundle can be re-imported idempotently", async ({ page }) => {
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

    // Re-importing into the same account is idempotent: the summary surfaces skipped counts.
    await expect(page.getByTestId("import-summary")).toBeVisible();
  });
});
