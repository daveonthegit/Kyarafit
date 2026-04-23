import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { authClient } from "./client";
import { nativeAppleSignIn, nativeLinkApple } from "./appleNative";
import { verifyOneTimeTokenFromUrl } from "./verifyOtt";

export type SocialProvider = "google" | "apple";

/** Result of starting social sign-in: immediate session (native / in-app browser), pending external browser, or user canceled. */
export type SocialSignInResult = "signed_in" | "pending_redirect" | "canceled";

type SocialRedirectResult = {
  data?: { url?: string } | null;
  error?: { message?: string } | null;
};

function parseOAuthUrl(data: unknown): string | undefined {
  return data && typeof data === "object" && "url" in data ? (data as { url?: string }).url : undefined;
}

/**
 * Sign-in: iOS Apple uses native ASAuthorization; Android Apple uses in-app auth session + OTT.
 * Google keeps the legacy flow (system browser / deep link + OTT via `Linking`).
 */
export async function startSocialSignIn(provider: SocialProvider): Promise<SocialSignInResult> {
  if (provider === "apple") {
    if (Platform.OS === "ios") {
      const r = await nativeAppleSignIn();
      return r === "signed_in" ? "signed_in" : "canceled";
    }

    const callbackURL = Linking.createURL("/");
    const { data, error } = await authClient.signIn.social({
      provider: "apple",
      callbackURL,
    });
    if (error) {
      throw new Error(error.message ?? "Sign in failed.");
    }
    const url = parseOAuthUrl(data);
    if (!url) {
      throw new Error("Could not start OAuth redirect.");
    }

    const session = await WebBrowser.openAuthSessionAsync(url, callbackURL);
    if (session.type !== "success" || !session.url) {
      return "canceled";
    }
    const ok = await verifyOneTimeTokenFromUrl(session.url);
    if (!ok) {
      throw new Error("Could not complete sign in.");
    }
    return "signed_in";
  }

  const callbackURL = Linking.createURL("/");
  const { data, error } = await authClient.signIn.social({
    provider,
    callbackURL,
  });
  if (error) {
    throw new Error(error.message ?? "Sign in failed.");
  }
  const url = parseOAuthUrl(data);
  if (!url) {
    throw new Error("Could not start OAuth redirect.");
  }
  await Linking.openURL(url);
  return "pending_redirect";
}

const authWithLinkSocial = authClient as typeof authClient & {
  linkSocial: (input: {
    provider: SocialProvider;
    callbackURL: string;
    errorCallbackURL: string;
  }) => Promise<SocialRedirectResult>;
};

async function completeLinkOAuthInWebBrowser(authUrl: string, callbackURL: string): Promise<void> {
  const session = await WebBrowser.openAuthSessionAsync(authUrl, callbackURL);
  if (session.type !== "success" || !session.url) {
    return;
  }
  const ok = await verifyOneTimeTokenFromUrl(session.url);
  if (!ok) {
    throw new Error("Could not complete account link.");
  }
}

/**
 * OAuth account linking from Settings: iOS Apple is native; Android Apple uses in-app auth session.
 */
export async function startSocialLink(provider: SocialProvider): Promise<void> {
  if (provider === "apple" && Platform.OS === "ios") {
    const r = await nativeLinkApple();
    if (r === "canceled") return;
    return;
  }

  const callbackURL = Linking.createURL("/settings/account");
  const { data, error } = await authWithLinkSocial.linkSocial({
    provider,
    callbackURL,
    errorCallbackURL: callbackURL,
  });
  if (error) {
    throw new Error(error.message ?? "Could not connect that account.");
  }
  const url = parseOAuthUrl(data);
  if (!url) {
    throw new Error("Could not start account link redirect.");
  }

  if (provider === "apple" && Platform.OS === "android") {
    await completeLinkOAuthInWebBrowser(url, callbackURL);
    return;
  }

  await Linking.openURL(url);
}
