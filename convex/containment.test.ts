/**
 * Containment tests outside the per-function authorization matrix in
 * `authz.test.ts`: the RevenueCat webhook fails closed, and user-controlled text is
 * escaped before it reaches an outgoing email body.
 */
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { sendNotificationEmail, sendWelcomeEmail } from "./emailHelpers";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const testEvent = JSON.stringify({ event: { type: "TEST", app_user_id: "someone" } });

function postWebhook(authorization?: string) {
  const t = convexTest(schema, modules);
  return t.fetch("/webhooks/revenuecat", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
    body: testEvent,
  });
}

describe("RevenueCat webhook fails closed", () => {
  test("rejects every request when the shared secret is not configured", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await postWebhook()).status).toBe(401);
    expect((await postWebhook("Bearer anything")).status).toBe(401);
  });

  test("rejects a missing or wrong secret when one is configured", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "s3cret");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");

    expect((await postWebhook()).status).toBe(401);
    expect((await postWebhook("Bearer wrong")).status).toBe(401);
  });

  test("accepts the configured secret, bare or as a bearer token", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "s3cret");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");

    expect((await postWebhook("Bearer s3cret")).status).toBe(200);
    expect((await postWebhook("s3cret")).status).toBe(200);
  });
});

describe("outgoing email bodies escape user-controlled text", () => {
  function captureResend() {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const sent: { html: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body));
        return new Response("{}", { status: 200 });
      })
    );
    return sent;
  }

  test("a display name containing markup is delivered as text", async () => {
    const sent = captureResend();
    await sendWelcomeEmail("a@example.com", `<a href="https://evil.example">x</a>`);

    expect(sent).toHaveLength(1);
    expect(sent[0].html).not.toContain(`<a href="https://evil.example">`);
    expect(sent[0].html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;x&lt;/a&gt;");
  });

  test("a notification message containing markup is delivered as text", async () => {
    const sent = captureResend();
    await sendNotificationEmail("a@example.com", "Hi", `<img src=x onerror=alert(1)>`);

    expect(sent[0].html).not.toContain("<img src=x");
    expect(sent[0].html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
