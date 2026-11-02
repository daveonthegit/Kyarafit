import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);
let t: ReturnType<typeof convexTest>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  t = convexTest(schema, modules);
  vi.stubEnv("BETTER_AUTH_SECRET", "auth-config-local-fixture-not-for-deployment");
  vi.stubEnv("SITE_URL", "https://app.example.invalid");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth.example.invalid");
  vi.stubEnv("AUTH_ENVIRONMENT", "production");
  vi.stubEnv("ADDITIONAL_CORS_ORIGINS", "");
  vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "webhook-local-fixture");
  vi.stubEnv("REVENUECAT_SECRET_API_KEY", "server-local-fixture");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function webhook(
  authorization = "Bearer webhook-local-fixture",
  body: unknown = { event: { app_user_id: "billing-fixture" } }
) {
  return t.fetch("/webhooks/revenuecat", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("billing webhook configuration and retries", () => {
  it("rejects missing or incorrect webhook authorization without upstream requests", async () => {
    expect((await webhook("wrong")).status).toBe(401);
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTHORIZATION", "");
    expect((await webhook()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("returns retryable failure rather than acknowledging missing server configuration", async () => {
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "");
    const response = await webhook();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["Bearer webhook-local-fixture", "webhook-local-fixture"])(
    "accepts configured authorization %s and applies authoritative tier",
    async (authorization) => {
      await t.run((ctx) =>
        ctx.db.insert("users", {
          externalId: "billing-fixture",
          email: "billing@example.invalid",
          currentUsageMb: 0,
          tier: "FREE",
        })
      );
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ subscriber: { entitlements: { supporter: { expires_date: null } } } })
        )
      );
      expect((await webhook(authorization)).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/subscribers/billing-fixture"),
        expect.objectContaining({
          headers: {
            Authorization: "Bearer server-local-fixture",
            "Content-Type": "application/json",
          },
        })
      );
      expect(await t.run(async (ctx) => (await ctx.db.query("users").first())?.tier)).toBe(
        "SUPPORTER"
      );
    }
  );
  it("acknowledges configured test events without calling upstream", async () => {
    expect((await webhook(undefined, { event: { type: "TEST" } })).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([429, 500, 401])("does not acknowledge upstream HTTP %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("provider-private-detail", { status }));
    expect((await webhook()).status).toBe(503);
    expect(console.error).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "provider-private-detail"
    );
  });
  it("returns retryable failures for network errors and invalid upstream JSON", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network detail"));
    expect((await webhook()).status).toBe(503);
    fetchMock.mockResolvedValueOnce(new Response("not-json"));
    expect((await webhook()).status).toBe(503);
    fetchMock.mockResolvedValueOnce(Response.json(null));
    expect((await webhook()).status).toBe(503);
  });
});
