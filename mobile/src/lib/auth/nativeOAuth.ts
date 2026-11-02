import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { EXPO_PUBLIC_CONVEX_SITE_URL, EXPO_PUBLIC_WEB_APP_URL } from "@/config/env";
import { authClient, setStoredBearerToken } from "./client";
import { getBearerToken } from "./bearer-storage-plugin";

/**
 * Browser OAuth for the app (server half: convex/betterAuth/nativeOAuth.ts).
 *
 * The app sends a PKCE challenge when it starts sign-in, opens the returned auth-host step in the
 * system auth session (which binds the OAuth state to that browser), and receives a single-use
 * code on the return link. Only this process holds the verifier that redeems the code, so a link
 * intercepted by another app — or delivered with no sign-in in progress — signs nobody in.
 */

export const NATIVE_RETURN_PATH = "/native/auth/return";
const CHALLENGE_HEADER = "x-kyarafit-code-challenge";

export type NativeOAuthKind = "sign-in" | "link";
export type NativeOAuthResult = "signed_in" | "linked" | "pending_redirect" | "canceled";

type Flow = { kind: NativeOAuthKind; verifier: string };

let active: Flow | null = null;
let settled: { url: string; result: Promise<boolean> } | null = null;

const toBase64Url = (base64: string) =>
  base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** RFC 7636 verifier: 32 random bytes, base64url (43 chars). */
export function createVerifier(): string {
  let binary = "";
  for (const byte of Crypto.getRandomBytes(32)) binary += String.fromCharCode(byte);
  return toBase64Url(btoa(binary));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return toBase64Url(digest);
}

/**
 * The claimed https return (Universal Link / App Link) when the web host is configured and the
 * platform can complete an auth session on it: iOS needs 17.4+ for https callbacks. Otherwise the
 * `kyarafit://` fallback, which the PKCE binding keeps safe if another app claims the scheme.
 */
function claimedReturnURL(webAppUrl: string): string | null {
  return webAppUrl.startsWith("https://")
    ? `${new URL(webAppUrl).origin}${NATIVE_RETURN_PATH}`
    : null;
}

export function nativeReturnURL(
  platform: { OS: string; Version: string | number } = Platform,
  webAppUrl: string = EXPO_PUBLIC_WEB_APP_URL
): string {
  const claimed = claimedReturnURL(webAppUrl);
  if (claimed && platform.OS === "android") return claimed;
  if (claimed && platform.OS === "ios") {
    const [major = 0, minor = 0] = String(platform.Version).split(".").map(Number);
    if (major > 17 || (major === 17 && minor >= 4)) return claimed;
  }
  return Linking.createURL(NATIVE_RETURN_PATH);
}

function isNativeReturn(url: string): boolean {
  const bare = url.split(/[?#]/)[0];
  return [
    claimedReturnURL(EXPO_PUBLIC_WEB_APP_URL),
    `kyarafit:/${NATIVE_RETURN_PATH}`,
    Linking.createURL(NATIVE_RETURN_PATH).split(/[?#]/)[0],
  ].includes(bare);
}

function bumpSessionSignal(): void {
  const signal = (
    authClient as { $sessionSignal?: { get: () => boolean; set: (v: boolean) => void } }
  ).$sessionSignal;
  if (signal) signal.set(!signal.get());
}

async function redeem(flow: Flow, url: string): Promise<boolean> {
  const params = Linking.parse(url).queryParams ?? {};
  if (typeof params.error === "string") {
    throw new Error(flow.kind === "link" ? "Could not connect that account." : "Sign in failed.");
  }
  if (typeof params.code !== "string" || !EXPO_PUBLIC_CONVEX_SITE_URL) return false;
  const token = flow.kind === "link" ? getBearerToken() : null;
  if (flow.kind === "link" && !token) return false;
  const res = await fetch(
    `${EXPO_PUBLIC_CONVEX_SITE_URL.replace(/\/$/, "")}/api/auth/native/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code: params.code, verifier: flow.verifier }),
    }
  );
  if (!res.ok) return false;
  const data = (await res.json()) as { token?: unknown; linked?: unknown };
  if (flow.kind === "link") return data.linked === true;
  if (typeof data.token !== "string" || !data.token) return false;
  await setStoredBearerToken(data.token);
  await authClient.getSession({
    fetchOptions: { headers: { Authorization: `Bearer ${data.token}` } },
  });
  bumpSessionSignal();
  return true;
}

/**
 * Finish the in-flight flow from its return link. Called with the auth session's result and from
 * the app-wide link handler (Android App Links and the scheme fallback arrive there); both see
 * the same outcome, and a link with no flow in progress is ignored.
 */
export function completeNativeReturn(url: string): Promise<boolean> {
  if (!isNativeReturn(url)) return Promise.resolve(false);
  if (settled?.url === url) return settled.result;
  const flow = active;
  active = null;
  if (!flow) return Promise.resolve(false);
  const result = redeem(flow, url);
  settled = { url, result };
  return result;
}

type StartRedirect = (input: {
  callbackURL: string;
  errorCallbackURL: string;
  disableRedirect: true;
  fetchOptions: { headers: Record<string, string> };
}) => Promise<{ data?: { url?: string } | null; error?: { message?: string } | null }>;

export async function runNativeOAuth(
  kind: NativeOAuthKind,
  start: StartRedirect
): Promise<NativeOAuthResult> {
  const verifier = createVerifier();
  const returnURL = nativeReturnURL();
  const { data, error } = await start({
    callbackURL: returnURL,
    errorCallbackURL: returnURL,
    disableRedirect: true,
    fetchOptions: { headers: { [CHALLENGE_HEADER]: await challengeFor(verifier) } },
  });
  if (error) throw new Error(error.message ?? "Sign in failed.");
  if (!data?.url) throw new Error("Could not start OAuth redirect.");

  active = { kind, verifier };
  let session: WebBrowser.WebBrowserAuthSessionResult;
  try {
    session = await WebBrowser.openAuthSessionAsync(data.url, returnURL, {
      preferUniversalLinks: returnURL.startsWith("https://"),
    });
  } catch (e) {
    active = null;
    throw e;
  }
  if (session.type === "success" && session.url) {
    if (!(await completeNativeReturn(session.url))) throw new Error("Could not complete sign in.");
    return kind === "link" ? "linked" : "signed_in";
  }
  // Android: when Chrome keeps the https return, the web fallback page hands the code back via
  // kyarafit://, which the app-wide link handler completes after the browser closes.
  if (Platform.OS === "android" && returnURL.startsWith("https://") && active) {
    return "pending_redirect";
  }
  active = null;
  return "canceled";
}
