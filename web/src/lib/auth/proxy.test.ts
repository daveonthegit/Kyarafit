// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { proxyAuthRequest } from "./proxy";

const ORIGIN = "https://app.example.invalid";

function upstream(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("set-auth-token", "session-token-fixture");
  headers.append("set-cookie", "__Secure-better-auth.session_token=a; HttpOnly; Secure");
  headers.append("set-cookie", "__Secure-better-auth.convex_jwt=b; HttpOnly; Secure");
  return vi.fn(async () => new Response(JSON.stringify(body), { ...init, headers }));
}

const request = (path: string, init?: RequestInit) => new Request(`${ORIGIN}${path}`, init);

describe("auth proxy", () => {
  it("never returns the session token to the browser, only the HttpOnly cookie", async () => {
    const forward = upstream({
      redirect: false,
      token: "session-token-fixture",
      user: { id: "u" },
    });
    const response = await proxyAuthRequest(
      request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-real-ip": "198.51.100.1" },
      }),
      forward
    );
    expect(await response.json()).toEqual({ redirect: false, user: { id: "u" } });
    expect(response.headers.get("set-auth-token")).toBeNull();
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it("strips tokens from session and session-list payloads", async () => {
    const session = await proxyAuthRequest(
      request("/api/auth/get-session"),
      upstream({ session: { id: "s", token: "t", userId: "u" }, user: { id: "u" } })
    );
    expect(await session.json()).toEqual({ session: { id: "s", userId: "u" }, user: { id: "u" } });
    const list = await proxyAuthRequest(
      request("/api/auth/list-sessions"),
      upstream([{ id: "s", token: "t" }])
    );
    expect(await list.json()).toEqual([{ id: "s" }]);
  });

  it("passes the short-lived Convex JWT through for the Convex client", async () => {
    const response = await proxyAuthRequest(
      request("/api/auth/convex/token"),
      upstream({ token: "jwt-fixture" })
    );
    expect(await response.json()).toEqual({ token: "jwt-fixture" });
  });

  it("throttles credential endpoints but never session refreshes", async () => {
    const ip = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 60; i++) {
      const refresh = await proxyAuthRequest(
        request("/api/auth/get-session", { headers: ip }),
        upstream({ session: null })
      );
      expect(refresh.status).toBe(200);
    }
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const signIn = await proxyAuthRequest(
        request("/api/auth/sign-in/email", { method: "POST", headers: ip }),
        upstream({})
      );
      statuses.push(signIn.status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
