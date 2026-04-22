import * as Linking from "expo-linking";

/**
 * Better Auth `callbackURL` / `redirectTo` values must match Convex `trustedOrigins`
 * (`kyarafit://`, etc.). Keep in sync with sign-up and email flows.
 */
export function mobileEmailCallbackUrl(): string {
  const url = Linking.createURL("/");
  return url.replace(/\/$/, "") + "/";
}

/** Password reset email opens this path in the app (see `requestPasswordReset.redirectTo`). */
export function mobileResetPasswordRedirectUrl(): string {
  return Linking.createURL("/reset-password");
}
