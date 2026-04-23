import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import {
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
} from "@/config/env";

let configured = false;

export function isRevenueCatSupportedPlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/** Safe to call multiple times; only configures once when a key exists. */
export function ensureRevenueCatConfigured(): void {
  if (!isRevenueCatSupportedPlatform()) return;
  if (configured) return;
  const apiKey =
    Platform.OS === "ios"
      ? EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) return;
  Purchases.configure({ apiKey });
  configured = true;
}

export async function revenueCatLogIn(appUserId: string): Promise<void> {
  if (!isRevenueCatSupportedPlatform()) return;
  const apiKey =
    Platform.OS === "ios"
      ? EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) return;
  ensureRevenueCatConfigured();
  await Purchases.logIn(appUserId);
}

export async function revenueCatLogOut(): Promise<void> {
  if (!isRevenueCatSupportedPlatform()) return;
  ensureRevenueCatConfigured();
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous — ignore
  }
}
