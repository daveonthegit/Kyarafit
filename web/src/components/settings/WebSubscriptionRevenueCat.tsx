"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorCode, type Package, PurchasesError } from "@revenuecat/purchases-js";
import { getPurchasesForUser, isRevenueCatWebBillingConfigured } from "@/lib/revenuecatWeb";

function formatWebPackageLabel(pkg: Package): string {
  const product = pkg.webBillingProduct;
  const title = product.title || product.identifier;
  const price = product.price.formattedPrice;
  return price ? `${title} — ${price}` : title;
}

type Props = {
  appUserId: string;
  /** Called after a successful purchase so Convex can refresh (webhook may be slightly delayed). */
  onPurchaseComplete?: () => void;
};

export function WebSubscriptionRevenueCat({ appUserId, onPurchaseComplete }: Props) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(isRevenueCatWebBillingConfigured());
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [working, setWorking] = useState(false);

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
      setWorking(true);
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
        setWorking(false);
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
    <div className="mt-4 space-y-3">
      <p className="text-[11px] text-kyar-textSecondary">
        Choose a plan below. Payments are handled securely in checkout.
      </p>
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
        <ul className="flex flex-col gap-2">
          {packages.map((pkg) => (
            <li key={pkg.identifier}>
              <button
                type="button"
                disabled={working}
                onClick={() => void onPurchase(pkg)}
                className="w-full rounded border border-gray-200 px-4 py-3 text-left text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"
              >
                {formatWebPackageLabel(pkg)}
              </button>
            </li>
          ))}
        </ul>
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
