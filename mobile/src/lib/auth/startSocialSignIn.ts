import * as Linking from "expo-linking";
import { authClient } from "./client";

export type SocialProvider = "google" | "apple";

/**
 * Opens the system browser for OAuth; deep link returns with ?ott= for exchange in root `_layout.tsx`.
 */
export async function startSocialSignIn(provider: SocialProvider): Promise<void> {
  const callbackURL = Linking.createURL("/");
  const { data, error } = await authClient.signIn.social({
    provider,
    callbackURL,
  });
  if (error) {
    throw new Error(error.message ?? "Sign in failed.");
  }
  const url =
    data && typeof data === "object" && "url" in data ? (data as { url?: string }).url : undefined;
  if (!url) {
    throw new Error("Could not start OAuth redirect.");
  }
  await Linking.openURL(url);
}
