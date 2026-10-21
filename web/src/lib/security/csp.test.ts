// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createNonce } from "./csp";

function directive(policy: string, name: string): string[] {
  const found = policy.split("; ").find((part) => part.startsWith(`${name} `));
  return found ? found.split(" ").slice(1) : [];
}

describe("content security policy", () => {
  it("runs only nonce-bearing scripts in production", () => {
    const scripts = directive(buildContentSecurityPolicy("abc"), "script-src");
    expect(scripts).toContain("'nonce-abc'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(directive(buildContentSecurityPolicy("abc"), "object-src")).toEqual(["'none'"]);
  });

  it("retains the document style exception", () => {
    expect(directive(buildContentSecurityPolicy("abc"), "style-src")).toContain("'unsafe-inline'");
  });

  it("denies all content and framing on API responses", async () => {
    const config = createRequire(import.meta.url)("../../../next.config.js");
    const rules = await config.headers();
    const api = rules.find((rule: { source: string }) => rule.source === "/api/:path*");
    const policy = api.headers.find(
      (header: { key: string }) => header.key === "Content-Security-Policy"
    ).value;
    expect(policy).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("creates a fresh unguessable nonce per request", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });
});
