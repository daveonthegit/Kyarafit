"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorCode, type Package, PurchasesError } from "@revenuecat/purchases-js";
import {
  PAID_SUBSCRIPTION_PLANS,
  formatPlanStorage,
  formatUsdPrice,
  type SubscriptionBillingInterval,
  type SubscriptionPlan,
} from "@kyarafit/design-system/domain/subscriptionPlans";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { useTier } from "@/lib/api/useTier";
import { getPurchasesForUser, isRevenueCatWebBillingConfigured } from "@/lib/revenuecatWeb";

function packageForProductId(packages: Package[], productId: string | undefined): Package | null {
  if (!productId) return null;
  return packages.find((pkg) => pkg.webBillingProduct.identifier === productId) ?? null;
}

function packageForPlanInterval(
  packages: Package[],
  plan: SubscriptionPlan,
  interval: SubscriptionBillingInterval
): Package | null {
  return packageForProductId(packages, plan.productIds[interval]);
}

function checkoutLabel(
  plan: SubscriptionPlan,
  interval: SubscriptionBillingInterval,
  pkg: Package | null
): string {
  const fallback =
    interval === "annual"
      ? formatUsdPrice(plan.annualPriceUsd)
      : formatUsdPrice(plan.monthlyPriceUsd);
  const price = pkg?.webBillingProduct.price.formattedPrice || fallback;
  return interval === "annual" ? `${price} / year` : `${price} / month`;
}

type Props = {
  appUserId: string;
  /** Called after a successful purchase so Convex can refresh (webhook may be slightly delayed). */
  onPurchaseComplete?: () => void;
};

export function WebSubscriptionRevenueCat({ appUserId, onPurchaseComplete }: Props) {
  const { data: tier } = useTier();
  const currentTier = normalizeConvexTier(tier?.tier ?? "FREE");
  const [packages, setPackages] = useState<Package[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(isRevenueCatWebBillingConfigured());
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [workingPackageId, setWorkingPackageId] = useState<string | null>(null);

  const packagesByPlan = useMemo(
    () =>
      PAID_SUBSCRIPTION_PLANS.map((plan) => ({
        plan,
        monthly: packageForPlanInterval(packages, plan, "monthly"),
        annual: packageForPlanInterval(packages, plan, "annual"),
      })),
    [packages]
  );

  useEffect(() => {
    if (!isRevenueCatWebBillingConfigured()) {
      setOfferingsLoading(false);
      setPackages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const p = await getPurchasesForUser(appUserId);
        if (!p || cancelled) return;
        const offerings = await p.getOfferings();
        if (cancelled) return;
        setPackages(offerings.current?.availablePackages ?? []);
        const info = await p.getCustomerInfo();
        if (!cancelled) setManageUrl(info.managementURL);
      } catch (e) {
        console.warn("[revenuecat-web] offerings", e);
        if (!cancelled) {
          setPackages([]);
          setManageUrl(null);
        }
      } finally {
        if (!cancelled) setOfferingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appUserId]);

  const onPurchase = useCallback(
    async (pkg: Package) => {
      setNotice(null);
      setWorkingPackageId(pkg.identifier);
      try {
        const p = await getPurchasesForUser(appUserId);
        if (!p) return;
        await p.purchase({ rcPackage: pkg });
        setNotice({
          tone: "ok",
          text: "Purchase completed. Your plan will update in a moment.",
        });
        onPurchaseComplete?.();
        const info = await p.getCustomerInfo();
        setManageUrl(info.managementURL);
      } catch (e: unknown) {
        if (e instanceof PurchasesError && e.errorCode === ErrorCode.UserCancelledError) {
          return;
        }
        setNotice({
          tone: "err",
          text: e instanceof Error ? e.message : "Purchase could not complete. Try again.",
        });
      } finally {
        setWorkingPackageId(null);
      }
    },
    [appUserId, onPurchaseComplete]
  );

  if (!isRevenueCatWebBillingConfigured()) {
    return (
      <p className="mt-1 text-[11px] text-kyar-textSecondary">
        Web checkout is not available yet. You can still subscribe from the iOS or Android app.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary">Checkout</p>
        <p className="mt-1 text-[11px] text-kyar-textSecondary">
          Choose a monthly or yearly option. Payments are handled securely by RevenueCat Web
          Billing.
        </p>
      </div>
      {notice ? (
        <p
          className={`text-sm ${notice.tone === "ok" ? "text-kyar-text" : "text-red-600"}`}
          role={notice.tone === "err" ? "alert" : undefined}
        >
          {notice.text}
        </p>
      ) : null}
      {offeringsLoading ? (
        <p className="text-sm text-kyar-textSecondary">Loading subscription offers…</p>
      ) : packages.length === 0 ? (
        <p className="text-sm text-kyar-textSecondary">
          No subscription plans are available right now. You can still subscribe from the iOS or
          Android app.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {packagesByPlan.map(({ plan, monthly, annual }) => (
            <div
              key={plan.id}
              className="rounded-lg border border-kyar-borderSubtle bg-kyar-surface/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl tracking-tight text-kyar-text">{plan.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-kyar-textSecondary">
                    {formatPlanStorage(plan.storageLimitMb)} storage - sync across all devices
                  </p>
                </div>
                {currentTier === plan.tier ? (
                  <span className="rounded-full border border-kyar-text px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-kyar-text">
                    Current
                  </span>
                ) : null}
              </div>
              {plan.payWhatYouWant ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(plan.presets ?? []).map((preset) => {
                    const pkg = packageForProductId(packages, preset.productId);
                    const missing = pkg == null;
                    const isCurrent = currentTier === plan.tier;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={missing || isCurrent || workingPackageId != null}
                        onClick={() => {
                          if (pkg) void onPurchase(pkg);
                        }}
                        className="min-h-[44px] rounded border border-kyar-borderSubtle px-3 py-2 text-left text-xs font-medium transition hover:border-kyar-text hover:bg-kyar-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="block text-[10px] uppercase tracking-widest text-kyar-textSecondary">
                          Supporter
                        </span>
                        <span className="mt-1 block text-sm text-kyar-text">
                          {missing
                            ? "Not configured"
                            : workingPackageId === pkg.identifier
                              ? "Opening checkout..."
                              : `${pkg.webBillingProduct.price.formattedPrice || formatUsdPrice(preset.monthlyPriceUsd)} / month`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(["monthly", "annual"] as const).map((interval) => {
                    const pkg = interval === "monthly" ? monthly : annual;
                    const missing = pkg == null;
                    const isCurrent = currentTier === plan.tier;
                    return (
                      <button
                        key={interval}
                        type="button"
                        disabled={missing || isCurrent || workingPackageId != null}
                        onClick={() => {
                          if (pkg) void onPurchase(pkg);
                        }}
                        className="min-h-[44px] rounded border border-kyar-borderSubtle px-3 py-2 text-left text-xs font-medium transition hover:border-kyar-text hover:bg-kyar-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="block text-[10px] uppercase tracking-widest text-kyar-textSecondary">
                          {interval === "monthly" ? "Monthly" : "Yearly"}
                        </span>
                        <span className="mt-1 block text-sm text-kyar-text">
                          {missing
                            ? "Not configured"
                            : workingPackageId === pkg.identifier
                              ? "Opening checkout..."
                              : checkoutLabel(plan, interval, pkg)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {manageUrl ? (
        <p className="pt-2">
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
          >
            Manage subscription
          </a>
        </p>
      ) : null}
    </div>
  );
}
