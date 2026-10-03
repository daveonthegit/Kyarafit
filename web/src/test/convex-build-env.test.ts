// @vitest-environment node
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../../next.config.js", import.meta.url));

// Load next.config.js in a fresh process so each case sees only the given env.
function buildEnv(values: Record<string, string>) {
  const env = { ...process.env };
  for (const name of [
    "CONVEX_URL",
    "CONVEX_SITE_URL",
    "NEXT_PUBLIC_CONVEX_URL",
    "NEXT_PUBLIC_CONVEX_SITE_URL",
  ]) {
    delete env[name];
  }
  return JSON.parse(
    execFileSync(
      process.execPath,
      ["-e", `console.log(JSON.stringify(require(${JSON.stringify(configPath)}).env ?? {}))`],
      { env: { ...env, ...values }, encoding: "utf8" }
    )
  );
}

const selected = {
  CONVEX_URL: "https://selected-example.convex.cloud",
  CONVEX_SITE_URL: "https://selected-example.convex.site",
};
const publicOnly = {
  NEXT_PUBLIC_CONVEX_URL: "https://public-example.convex.cloud",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://public-example.convex.site",
};

describe("Next build Convex environment", () => {
  it("exposes the URLs supplied by convex deploy as public build variables", () => {
    expect(buildEnv(selected)).toMatchObject({
      NEXT_PUBLIC_CONVEX_URL: selected.CONVEX_URL,
      NEXT_PUBLIC_CONVEX_SITE_URL: selected.CONVEX_SITE_URL,
    });
  });

  it("prefers the selected deployment over stale public values", () => {
    expect(buildEnv({ ...publicOnly, ...selected })).toMatchObject({
      NEXT_PUBLIC_CONVEX_URL: selected.CONVEX_URL,
      NEXT_PUBLIC_CONVEX_SITE_URL: selected.CONVEX_SITE_URL,
    });
  });

  it("keeps public-only configuration working", () => {
    expect(buildEnv(publicOnly)).toMatchObject(publicOnly);
  });
});
