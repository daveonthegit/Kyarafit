// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const configure = require("../../../app.config.js");
const base = require("../../../app.json").expo;

afterEach(() => vi.unstubAllEnvs());

describe("claimed app links", () => {
  it("claims /native/* on the web host for both platforms", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_APP_URL", "https://app.example.invalid");
    const config = configure({ config: base });
    expect(config.ios.associatedDomains).toEqual([
      "applinks:app.example.invalid",
      "webcredentials:app.example.invalid",
    ]);
    expect(config.ios.bundleIdentifier).toBe(base.ios.bundleIdentifier);
    expect(config.android.intentFilters).toEqual([
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "app.example.invalid", pathPrefix: "/native/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ]);
    expect(config.android.package).toBe(base.android.package);
    // The custom scheme stays registered only as the PKCE-bound fallback.
    expect(config.scheme).toBe("kyarafit");
  });

  it("defaults to the production app host", () => {
    vi.stubEnv("EXPO_PUBLIC_WEB_APP_URL", "");
    expect(configure({ config: base }).ios.associatedDomains[0]).toBe("applinks:app.kyarafit.com");
  });
});
