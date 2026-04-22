/**
 * Mobile may only read `EXPO_PUBLIC_*` at runtime (Expo strips others in release).
 * Import from here instead of `process.env` directly outside this module.
 */
export const EXPO_PUBLIC_CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
export const EXPO_PUBLIC_CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "";
export const EXPO_PUBLIC_SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
/** Optional origin for opening web-only routes in an in-app browser (e.g. https://kyarafit.example). No trailing slash. */
export const EXPO_PUBLIC_WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "";
