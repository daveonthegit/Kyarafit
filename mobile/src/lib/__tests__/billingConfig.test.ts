import { afterEach, describe, expect, it, vi } from "vitest";

const { platform, configure } = vi.hoisted(() => {
  vi.stubGlobal("__DEV__", true);
  return { platform: { OS: "ios" }, configure: vi.fn() };
});
vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("react-native-purchases", () => ({
  default: { configure },
  LOG_LEVEL: { DEBUG: "debug" },
  PURCHASES_ERROR_CODE: {},
}));
const { resolveRevenueCatConfig } = await import("../../config/env");
const blank = { platform: "ios", development: true, generic: "", ios: "", android: "" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubGlobal("__DEV__", true);
  platform.OS = "ios";
  configure.mockClear();
  vi.resetModules();
});

describe("mobile billing configuration", () => {
  it("keeps local non-billing mode available without a default SDK key", () => {
    expect(resolveRevenueCatConfig(blank)).toEqual({ generic: "", ios: "", android: "" });
  });
  it.each(["ios", "android"])("allows explicit development test config on %s", (platform) => {
    expect(
      resolveRevenueCatConfig({ ...blank, platform, generic: "test_local-fixture" }).generic
    ).toBe("test_local-fixture");
  });
  it.each(["ios", "android"])(
    "requires platform-specific release config on %s even with a generic key",
    (platform) => {
      expect(() =>
        resolveRevenueCatConfig({
          ...blank,
          platform,
          development: false,
          generic: "test_local-fixture",
        })
      ).toThrow("release configuration");
    }
  );
  it.each(["test_local-fixture", "goog_android-fixture", "appl_"])(
    "rejects inappropriate iOS release config: %s",
    (ios) => {
      expect(() => resolveRevenueCatConfig({ ...blank, development: false, ios })).toThrow("ios");
    }
  );
  it.each(["test_local-fixture", "appl_ios-fixture", "goog_"])(
    "rejects inappropriate Android release config: %s",
    (android) => {
      expect(() =>
        resolveRevenueCatConfig({ ...blank, platform: "android", development: false, android })
      ).toThrow("android");
    }
  );
  it.each([
    ["ios", "appl_ios-fixture", ""],
    ["android", "", "goog_android-fixture"],
  ])("validates only the target release platform %s", (platform, ios, android) => {
    expect(
      resolveRevenueCatConfig({
        ...blank,
        platform,
        development: false,
        generic: "test_local-fixture",
        ios,
        android,
      })
    ).toEqual({ generic: "", ios, android });
  });
  it.each([
    ["ios", "appl_ios-fixture"],
    ["android", "goog_android-fixture"],
  ])("configures the billing SDK with only the selected %s release key", async (os, key) => {
    platform.OS = os;
    vi.stubGlobal("__DEV__", false);
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_local-fixture");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", os === "ios" ? key : "");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", os === "android" ? key : "");
    const billing = await import("../revenuecat");
    expect(billing.getRevenueCatApiKey()).toBe(key);
    billing.ensureRevenueCatConfigured();
    expect(configure).toHaveBeenCalledWith({ apiKey: key });
  });
  it("does not require native billing config on web", () => {
    expect(resolveRevenueCatConfig({ ...blank, development: false, platform: "web" })).toEqual({
      generic: "",
      ios: "",
      android: "",
    });
  });
  it("exports empty local configuration when no environment keys exist", async () => {
    vi.stubGlobal("__DEV__", true);
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", "");
    const env = await import("../../config/env");
    expect(env.EXPO_PUBLIC_REVENUECAT_API_KEY).toBe("");
    expect(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY).toBe("");
  });
  it("fails release module initialization without the target platform SDK key", async () => {
    vi.stubGlobal("__DEV__", false);
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_API_KEY", "test_local-fixture");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "");
    await expect(import("../../config/env")).rejects.toThrow("ios");
    vi.stubGlobal("__DEV__", true);
  });
});
