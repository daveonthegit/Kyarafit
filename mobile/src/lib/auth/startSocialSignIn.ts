import { Platform } from "react-native";
import { authClient } from "./client";
import { nativeAppleSignIn, nativeLinkApple } from "./appleNative";
import { runNativeOAuth } from "./nativeOAuth";

export type SocialProvider = "google" | "apple";

/** Result of starting social sign-in: immediate session, pending return link, or user canceled. */
export type SocialSignInResult = "signed_in" | "pending_redirect" | "canceled";

const authWithLinkSocial = authClient as typeof authClient & {
  linkSocial: (
    input: { provider: SocialProvider } & Parameters<Parameters<typeof runNativeOAuth>[1]>[0]
  ) => ReturnType<Parameters<typeof runNativeOAuth>[1]>;
};

/**
 * Sign-in: iOS Apple uses native ASAuthorization; every other provider runs the browser-bound,
 * PKCE-protected flow in the system auth session (see nativeOAuth.ts).
 */
export async function startSocialSignIn(provider: SocialProvider): Promise<SocialSignInResult> {
  if (provider === "apple" && Platform.OS === "ios") {
    const r = await nativeAppleSignIn();
    return r === "signed_in" ? "signed_in" : "canceled";
  }
  const result = await runNativeOAuth("sign-in", (input) =>
    authClient.signIn.social({ provider, ...input })
  );
  return result === "linked" ? "signed_in" : result;
}

/** OAuth account linking from Settings: iOS Apple is native; others use the auth session. */
export async function startSocialLink(provider: SocialProvider): Promise<void> {
  if (provider === "apple" && Platform.OS === "ios") {
    await nativeLinkApple();
    return;
  }
  await runNativeOAuth("link", (input) => authWithLinkSocial.linkSocial({ provider, ...input }));
}
