"use client";

import { Purchases } from "@revenuecat/purchases-js";

/**
 * Public SDK key for RevenueCat **Web Billing** (dashboard → Web app → API keys).
 * Often prefixed `rcb_`. Stripe is connected only inside RevenueCat; this app does not load the Stripe.js SDK.
 */
export function getRevenueCatWebBillingApiKey(): string | undefined {
  const k = process.env.NEXT_PUBLIC_REVENUECAT_WEB_BILLING_API_KEY;
  return k && k.trim() !== "" ? k.trim() : undefined;
}

export function isRevenueCatWebBillingConfigured(): boolean {
  return getRevenueCatWebBillingApiKey() !== undefined;
}

/**
 * Returns a configured {@link Purchases} instance for the given app user id (must match Convex `users.externalId`).
 * Call from client only. If the singleton already exists with a different user, awaits {@link Purchases.changeUser}.
 */
export async function getPurchasesForUser(appUserId: string): Promise<Purchases | null> {
  const apiKey = getRevenueCatWebBillingApiKey();
  if (!apiKey || typeof window === "undefined") return null;

  if (Purchases.isConfigured()) {
    const p = Purchases.getSharedInstance();
    if (p.getAppUserId() !== appUserId) {
      await p.changeUser(appUserId);
    }
    return p;
  }
  return Purchases.configure({ apiKey, appUserId });
}
