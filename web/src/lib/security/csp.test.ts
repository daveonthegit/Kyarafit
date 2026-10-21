// @vitest-environment node
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

  it("allows eval only for local development tooling", () => {
    const scripts = directive(
      buildContentSecurityPolicy("abc", { development: true }),
      "script-src"
    );
    expect(scripts).toContain("'unsafe-eval'");
  });

  it("creates a fresh unguessable nonce per request", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });
});
