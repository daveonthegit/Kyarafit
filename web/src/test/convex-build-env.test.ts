// @vitest-environment node
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../../next.config.js", import.meta.url));

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
      {
        env: { ...env, ...values },
        encoding: "utf8",
      }
    )
  );
}

const preview = {
  CONVEX_URL: "https://preview-example.convex.cloud",
  CONVEX_SITE_URL: "https://preview-example.convex.site",
};
const production = {
  NEXT_PUBLIC_CONVEX_URL: "https://production-example.convex.cloud",
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://production-example.convex.site",
};

describe("Next build Convex environment", () => {
  it("exposes both canonical URLs supplied by convex deploy to server and browser code", () => {
    expect(buildEnv(preview)).toMatchObject({
      NEXT_PUBLIC_CONVEX_URL: preview.CONVEX_URL,
      NEXT_PUBLIC_CONVEX_SITE_URL: preview.CONVEX_SITE_URL,
    });
  });

  it("prefers the selected deployment over stale public environment values", () => {
    expect(buildEnv({ ...production, ...preview })).toMatchObject({
      NEXT_PUBLIC_CONVEX_URL: preview.CONVEX_URL,
      NEXT_PUBLIC_CONVEX_SITE_URL: preview.CONVEX_SITE_URL,
    });
  });

  it("preserves public-only configuration for production and local builds", () => {
    expect(buildEnv(production)).toMatchObject(production);
  });
});
