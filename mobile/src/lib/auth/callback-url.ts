import * as Linking from "expo-linking";
import { EXPO_PUBLIC_WEB_APP_URL } from "@/config/env";

/**
 * Better Auth `callbackURL` / `redirectTo` values must match Convex `trustedOrigins`.
 * Email verification carries no credential back, so it may reopen the app by scheme.
 */
export function mobileEmailCallbackUrl(): string {
  const url = Linking.createURL("/");
  return url.replace(/\/$/, "") + "/";
}

/**
 * Password reset links carry a reset token, so they land on the web reset page over https
 * rather than a `kyarafit://` link another app could claim. Only builds without a web origin
 * (local development) fall back to the in-app screen.
 */
export function mobileResetPasswordRedirectUrl(): string {
  return EXPO_PUBLIC_WEB_APP_URL.startsWith("https://")
    ? `${new URL(EXPO_PUBLIC_WEB_APP_URL).origin}/auth/reset-password`
    : Linking.createURL("/reset-password");
}
