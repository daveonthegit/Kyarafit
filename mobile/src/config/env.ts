import { Platform } from "react-native";

/**
 * Mobile may only read `EXPO_PUBLIC_*` at runtime (Expo strips others in release).
 * Import from here instead of `process.env` directly outside this module.
 */
export const EXPO_PUBLIC_CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
export const EXPO_PUBLIC_CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "";
export const EXPO_PUBLIC_SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
/** Optional origin for opening web-only routes in an in-app browser (e.g. https://kyarafit.example). No trailing slash. */
export const EXPO_PUBLIC_WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";
/** Validate only the native platform being released; local non-billing mode stays optional. */
export function resolveRevenueCatConfig(config: {
  platform: string;
  development: boolean;
  generic: string;
  ios: string;
  android: string;
}) {
  const generic = config.development ? config.generic.trim() : "";
  const ios = config.ios.trim();
  const android = config.android.trim();
  if (!config.development && (config.platform === "ios" || config.platform === "android")) {
    const key = config.platform === "ios" ? ios : android;
    const prefix = config.platform === "ios" ? "appl_" : "goog_";
    if (!key.startsWith(prefix) || key.length <= prefix.length) {
      throw new Error(
        `RevenueCat release configuration requires the ${config.platform} public SDK key`
      );
    }
  }
  return { generic, ios, android };
}

// Keep direct EXPO_PUBLIC reads so Expo can inline them in release bundles.
const billing = resolveRevenueCatConfig({
  platform: Platform.OS,
  development: __DEV__,
  generic: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "",
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "",
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "",
});
export const EXPO_PUBLIC_REVENUECAT_API_KEY = billing.generic;
export const EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = billing.ios;
export const EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY = billing.android;
