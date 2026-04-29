import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type MakePurchaseResult,
  type PurchasesPackage,
} from "react-native-purchases";
import type { PAYWALL_RESULT, PresentCustomerCenterParams } from "react-native-purchases-ui";
import {
  EXPO_PUBLIC_REVENUECAT_API_KEY,
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
} from "@/config/env";

export const REVENUECAT_ENTITLEMENTS = {
  pro: "pro",
} as const;

export const REVENUECAT_PRODUCT_IDS = {
  studioMonthly: "com.kyarafit.studio.monthly",
  studioAnnual: "com.kyarafit.studio.annual",
  proMonthly: "com.kyarafit.pro.monthly",
  proAnnual: "com.kyarafit.pro.annual",
  lifetime: "lifetime",
  yearly: "yearly",
  monthly: "monthly",
} as const;

export const REVENUECAT_SUBSCRIPTION_PRODUCT_IDS = [
  REVENUECAT_PRODUCT_IDS.studioMonthly,
  REVENUECAT_PRODUCT_IDS.studioAnnual,
  REVENUECAT_PRODUCT_IDS.proMonthly,
  REVENUECAT_PRODUCT_IDS.proAnnual,
  REVENUECAT_PRODUCT_IDS.yearly,
  REVENUECAT_PRODUCT_IDS.monthly,
] as const;

let configured = false;

export function isRevenueCatSupportedPlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function getRevenueCatApiKey(): string {
  if (Platform.OS === "ios") {
    return EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || EXPO_PUBLIC_REVENUECAT_API_KEY;
  }
  if (Platform.OS === "android") {
    return EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || EXPO_PUBLIC_REVENUECAT_API_KEY;
  }
  return "";
}

export function isRevenueCatConfigured(): boolean {
  return isRevenueCatSupportedPlatform() && getRevenueCatApiKey().length > 0;
}

/** Safe to call multiple times; only configures once when a key exists. */
export function ensureRevenueCatConfigured(): void {
  if (!isRevenueCatSupportedPlatform()) return;
  if (configured) return;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) return;
  Purchases.configure({ apiKey });
  if (__DEV__) {
    void Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  configured = true;
}

function assertRevenueCatReady(): void {
  ensureRevenueCatConfigured();
  if (!isRevenueCatConfigured()) {
    throw new Error("RevenueCat is not configured for this platform.");
  }
}

export async function revenueCatLogIn(appUserId: string): Promise<void> {
  if (!isRevenueCatSupportedPlatform()) return;
  const apiKey = getRevenueCatApiKey();
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

export function customerHasEntitlement(
  customerInfo: CustomerInfo | null | undefined,
  entitlementId: string
): boolean {
  return customerInfo?.entitlements.active[entitlementId]?.isActive === true;
}

export function customerHasProEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  return customerHasEntitlement(customerInfo, REVENUECAT_ENTITLEMENTS.pro);
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isRevenueCatSupportedPlatform()) return null;
  assertRevenueCatReady();
  return Purchases.getCustomerInfo();
}

export function addRevenueCatCustomerInfoUpdateListener(
  listener: CustomerInfoUpdateListener
): () => void {
  ensureRevenueCatConfigured();
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export async function purchaseRevenueCatPackage(
  pkg: PurchasesPackage
): Promise<MakePurchaseResult> {
  assertRevenueCatReady();
  return Purchases.purchasePackage(pkg);
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  assertRevenueCatReady();
  return Purchases.restorePurchases();
}

export function isRevenueCatPurchaseCancelled(error: unknown): boolean {
  return (
    (error as { code?: PURCHASES_ERROR_CODE; userCancelled?: boolean } | null)?.code ===
      PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    (error as { userCancelled?: boolean } | null)?.userCancelled === true
  );
}

export function didRevenueCatPaywallUnlockEntitlement(
  result: PAYWALL_RESULT | null | undefined
): boolean {
  return result === "PURCHASED" || result === "RESTORED" || result === "NOT_PRESENTED";
}

export async function presentRevenueCatPaywall(): Promise<PAYWALL_RESULT> {
  assertRevenueCatReady();
  const { default: RevenueCatUI } = await import("react-native-purchases-ui");
  return RevenueCatUI.presentPaywall();
}

export async function presentProPaywallIfNeeded(): Promise<PAYWALL_RESULT> {
  assertRevenueCatReady();
  const { default: RevenueCatUI } = await import("react-native-purchases-ui");
  return RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENTS.pro,
  });
}

export async function presentRevenueCatCustomerCenter(
  callbacks?: PresentCustomerCenterParams["callbacks"]
): Promise<void> {
  assertRevenueCatReady();
  const { default: RevenueCatUI } = await import("react-native-purchases-ui");
  await RevenueCatUI.presentCustomerCenter(callbacks ? { callbacks } : undefined);
}
