"use client";

import Link from "next/link";
import { useTier } from "@/lib/api/useTier";
import { formatStorageMb } from "@/lib/utils";
import { WebAppShell } from "@/components/layout/WebAppShell";

export default function SettingsSubscriptionPage() {
  const { data: tier, isLoading } = useTier();
  const isFree = tier?.tier === "FREE";

  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">Settings</p>
          <h1 className="font-serif text-4xl tracking-tight">Subscription Plan</h1>
        </div>
        <Link href="/settings" className="p-2 -mr-2" aria-label="Back to settings">
          <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
        </Link>
      </header>

      <main className="mt-10">
        {isLoading && <p className="text-sm text-kyar-textSecondary">Loading…</p>}
        {!isLoading && tier && (
          <section className="space-y-6">
            <div className="py-3 border-b border-gray-100">
              <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                Current plan
              </p>
              <p className="text-sm font-medium" data-testid="subscription-tier">
                {tier.tier}
              </p>
            </div>
            {tier.storageLimitMb >= 0 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  Storage
                </p>
                <p className="text-sm" data-testid="subscription-storage">
                  {formatStorageMb(tier.currentUsageMb)} / {formatStorageMb(tier.storageLimitMb)}
                </p>
              </div>
            )}
            {tier.storageLimitMb === -1 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  Storage
                </p>
                <p className="text-sm" data-testid="subscription-storage">
                  {formatStorageMb(tier.currentUsageMb)} used (unlimited)
                </p>
              </div>
            )}
            <div className="pt-4">
              {isFree ? (
                <>
                  <Link
                    href="/settings"
                    className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
                  >
                    Upgrade
                  </Link>
                  <p className="mt-1 text-[11px] text-kyar-textSecondary">
                    Upgrade for backup, export, and more storage.
                  </p>
                </>
              ) : (
                <Link
                  href="/settings"
                  className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
                >
                  Manage subscription
                </Link>
              )}
              <p className="mt-1 text-[11px] text-kyar-textSecondary">
                Stripe checkout and portal coming soon.
              </p>
            </div>
          </section>
        )}
        {!isLoading && !tier && (
          <p className="text-sm text-kyar-textSecondary">Sign in to see your plan.</p>
        )}
      </main>
    </WebAppShell>
  );
}
