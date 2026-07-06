import { test, expect } from "@playwright/test";

/**
 * Public-surface smoke tests. These need only a running app (no auth, no seeded data), so they are
 * the first thing to go green once the harness is wired to a live `next dev` + Convex dev URL.
 */
test.describe("public surfaces", () => {
  test("landing page renders the Kyarafit wordmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /kyarafit/i }).first()).toBeVisible();
  });

  test("sign-in page shows the email/password form", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("a protected route redirects an anonymous visitor to sign-in", async ({ page }) => {
    // AuthGate (src/components/AuthGate.tsx) client-redirects non-public paths to /auth/signin.
    await page.goto("/settings/data");
    await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });
});
