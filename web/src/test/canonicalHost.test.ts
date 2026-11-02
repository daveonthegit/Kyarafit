// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/components/AuthGate";

type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: string; value: string }[];
};

async function redirects(): Promise<Redirect[]> {
  const config = createRequire(import.meta.url)("../../next.config.js");
  return config.redirects();
}

/** Resolve a request the way Next applies these host rules: first matching host wins. */
async function resolve(host: string, path: string): Promise<{ status: number; location?: string }> {
  const rule = (await redirects()).find((r) =>
    r.has?.some((h) => h.type === "host" && h.value === host)
  );
  if (!rule) return { status: 200 };
  expect(rule.source).toBe("/:path*");
  return {
    status: rule.permanent ? 308 : 307,
    location: rule.destination.replace("/:path*", path),
  };
}

describe("canonical production host (sign-in lives at https://www.kyarafit.com/api/auth)", () => {
  it.each(["kyarafit-web.vercel.app", "kyarafit.com", "app.kyarafit.com"])(
    "permanently redirects %s to www with the path preserved",
    async (host) => {
      expect(await resolve(host, "/build-detail/abc")).toEqual({
        status: 308,
        location: "https://www.kyarafit.com/build-detail/abc",
      });
      expect(await resolve(host, "/api/auth/callback/google")).toMatchObject({
        location: "https://www.kyarafit.com/api/auth/callback/google",
      });
    }
  );

  it.each(["www.kyarafit.com", "localhost", "kyarafit-abc123-david-xiaos-projects.vercel.app"])(
    "serves %s directly, so the app and its auth stay on one host",
    async (host) => {
      expect(await resolve(host, "/home")).toEqual({ status: 200 });
    }
  );
});

describe("public paths", () => {
  it("lets signed-out visitors open shared group pages, like build and profile shares", () => {
    expect(isPublicPath("/g/group123")).toBe(true);
    expect(isPublicPath("/b/build123")).toBe(true);
    expect(isPublicPath("/u/someone")).toBe(true);
    expect(isPublicPath("/groups")).toBe(false);
    expect(isPublicPath("/home")).toBe(false);
  });
});
