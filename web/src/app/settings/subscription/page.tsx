"use client";

import Link from "next/link";
import {
  SUBSCRIPTION_PLANS,
  formatPlanBuildLimit,
  formatPlanStorage,
  formatUsdPrice,
  getSubscriptionPlanByTier,
  type SubscriptionPlan,
} from "@kyarafit/design-system/domain/subscriptionPlans";
import {
  normalizeConvexTier,
  type ConvexTier,
} from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { useTier } from "@/lib/api/useTier";
import { formatStorageMb } from "@/lib/utils";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { WebSubscriptionRevenueCat } from "@/components/settings/WebSubscriptionRevenueCat";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function PlanCard({ plan, currentTier }: { plan: SubscriptionPlan; currentTier: ConvexTier }) {
  const isCurrent = plan.tier === currentTier;
  const isPaid = plan.id !== "free";

  return (
    <article
      className={`flex h-full flex-col rounded-lg border p-5 ${
        isCurrent
          ? "border-kyar-text bg-kyar-surface"
          : "border-kyar-borderSubtle bg-kyar-surface/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary">
            {plan.shortName}
          </p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight text-kyar-text">{plan.name}</h2>
        </div>
        {isCurrent ? (
          <span className="rounded-full border border-kyar-text px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-kyar-text">
            Current
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-kyar-textSecondary">{plan.tagline}</p>

      <div className="mt-5 border-t border-kyar-borderSubtle pt-5">
        <p className="font-serif text-4xl tracking-tight text-kyar-text">
          {formatUsdPrice(plan.monthlyPriceUsd)}
          <span className="ml-1 font-sans text-sm text-kyar-textSecondary">/ mo</span>
        </p>
        <p className="mt-1 text-xs text-kyar-textSecondary">
          {isPaid
            ? `${formatUsdPrice(plan.annualPriceUsd)} / year${
                plan.annualSavingsLabel ? ` - ${plan.annualSavingsLabel}` : ""
              }`
            : "No payment required"}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-kyar-borderSubtle pt-5">
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-kyar-textSecondary">Storage</dt>
          <dd className="mt-1 text-sm font-medium text-kyar-text">
            {formatPlanStorage(plan.storageLimitMb)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-widest text-kyar-textSecondary">Builds</dt>
          <dd className="mt-1 text-sm font-medium text-kyar-text">
            {formatPlanBuildLimit(plan.maxBuilds)}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-2 text-sm leading-6 text-kyar-text">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <span className="material-symbols-outlined mt-0.5 text-[16px]" aria-hidden>
              check
            </span>
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function SettingsSubscriptionPage() {
  const { data: tier, isLoading } = useTier();
  const { userId } = useCurrentUser();
  const tierCode = tier ? normalizeConvexTier(tier.tier) : "FREE";
  const isFree = tierCode === "FREE";
  const currentPlan = getSubscriptionPlanByTier(tierCode);

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
          <section className="space-y-10">
            <div className="rounded-lg border border-kyar-borderSubtle bg-kyar-surface/60 p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                    Current plan
                  </p>
                  <p className="font-serif text-3xl tracking-tight" data-testid="subscription-tier">
                    {currentPlan.name}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-kyar-textSecondary">
                    {currentPlan.audience}
                  </p>
                </div>
                <div className="min-w-48 rounded-lg border border-kyar-borderSubtle px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                    Storage
                  </p>
                  {tier.storageLimitMb >= 0 ? (
                    <p className="text-sm" data-testid="subscription-storage">
                      {formatStorageMb(tier.currentUsageMb)} /{" "}
                      {formatStorageMb(tier.storageLimitMb)}
                    </p>
                  ) : (
                    <p className="text-sm" data-testid="subscription-storage">
                      {formatStorageMb(tier.currentUsageMb)} used (unlimited)
                    </p>
                  )}
                </div>
              </div>
            </div>

            <section aria-labelledby="plans-heading">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="meta-label mb-2 opacity-40">Plans</p>
                  <h2 id="plans-heading" className="font-serif text-3xl tracking-tight">
                    Choose the room your studio needs
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-kyar-textSecondary">
                  Annual pricing gives committed makers a lower effective monthly cost while keeping
                  Free useful for a small personal archive.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {SUBSCRIPTION_PLANS.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} currentTier={tierCode} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-kyar-borderSubtle bg-kyar-surface/60 p-5">
              <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-3">
                What changes when you upgrade
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-kyar-text">Pro unlocks momentum</h3>
                  <p className="mt-2 text-sm leading-6 text-kyar-textSecondary">
                    More builds, more image storage, collaboration invites, import/export, and
                    advanced planning for deadlines and nested build tasks.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-kyar-text">Studio removes ceilings</h3>
                  <p className="mt-2 text-sm leading-6 text-kyar-textSecondary">
                    Unlimited storage and builds, CSV/PDF exports, and priority support for creators
                    running many looks or a small cosplay team.
                  </p>
                </div>
              </div>
            </section>

            <section>
              {isFree ? (
                <div className="mb-3">
                  <p className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent">
                    Upgrade
                  </p>
                  <p className="mt-1 text-[11px] text-kyar-textSecondary">
                    Upgrade for backup, export, collaboration, advanced planning, and more storage.
                  </p>
                </div>
              ) : (
                <div className="mb-3">
                  <p className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent">
                    Manage subscription
                  </p>
                  <p className="mt-1 text-[11px] text-kyar-textSecondary">
                    Your plan updates automatically after purchase, restore, cancellation, or
                    renewal.
                  </p>
                </div>
              )}
              {userId ? <WebSubscriptionRevenueCat appUserId={userId} /> : null}
            </section>
          </section>
        )}
        {!isLoading && !tier && (
          <p className="text-sm text-kyar-textSecondary">Sign in to see your plan.</p>
        )}
      </main>
    </WebAppShell>
  );
}
