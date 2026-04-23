import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { authClient, setStoredBearerToken } from "./client";

const authLinkSocial = authClient as typeof authClient & {
  linkSocial: (input: {
    provider: "apple";
    callbackURL?: string;
    errorCallbackURL?: string;
    idToken: { token: string; nonce?: string };
  }) => Promise<{ error?: { message?: string } | null }>;
};

function randomNonce(): string {
  const bytes = Crypto.getRandomBytes(32);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bumpSessionSignal(): void {
  const signal = (
    authClient as { $sessionSignal?: { get: () => boolean; set: (v: boolean) => void } }
  ).$sessionSignal;
  if (signal) {
    const val = signal.get();
    signal.set(!val);
  }
}

/** Native Sign in with Apple (iOS only). Completes bearer session on success. */
export async function nativeAppleSignIn(): Promise<"signed_in" | "canceled"> {
  if (Platform.OS !== "ios") {
    throw new Error("Native Apple sign-in is only available on iOS.");
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sign in with Apple is not available on this device.");
  }

  const nonce = randomNonce();

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    const { data, error } = await authClient.signIn.social({
      provider: "apple",
      idToken: {
        token: credential.identityToken,
        nonce,
      },
    });

    if (error) {
      throw new Error(error.message ?? "Sign in failed.");
    }

    const token = data && typeof data === "object" && "token" in data ? data.token : undefined;
    if (typeof token !== "string" || !token) {
      throw new Error("No session token returned.");
    }

    await setStoredBearerToken(token);
    await authClient.getSession({
      fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
    });
    bumpSessionSignal();

    return "signed_in";
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return "canceled";
    }
    throw e instanceof Error ? e : new Error("Apple sign-in failed.");
  }
}

/** Link Apple from Settings using the native iOS flow (no Safari redirect). */
export async function nativeLinkApple(): Promise<"linked" | "canceled"> {
  if (Platform.OS !== "ios") {
    throw new Error("Native Apple linking is only available on iOS.");
  }

  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Sign in with Apple is not available on this device.");
  }

  const nonce = randomNonce();
  const fallbackCallback = Linking.createURL("/settings/account");

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    const { error } = await authLinkSocial.linkSocial({
      provider: "apple",
      callbackURL: fallbackCallback,
      errorCallbackURL: fallbackCallback,
      idToken: {
        token: credential.identityToken,
        nonce,
      },
    });

    if (error) {
      throw new Error(error.message ?? "Could not connect that account.");
    }

    bumpSessionSignal();
    return "linked";
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return "canceled";
    }
    throw e instanceof Error ? e : new Error("Apple linking failed.");
  }
}
