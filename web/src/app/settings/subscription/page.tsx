"use client";

import {
  SUBSCRIPTION_PLANS,
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
import { formatStorageMb } from "@kyarafit/design-system/domain/cloudStoragePolicy";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { WebSubscriptionRevenueCat } from "@/components/settings/WebSubscriptionRevenueCat";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function PlanCard({ plan, currentTier }: { plan: SubscriptionPlan; currentTier: ConvexTier }) {
  const isCurrent = plan.tier === currentTier;
  const isPaid = plan.id !== "free";

  return (
    <article
      className={`flex h-full flex-col rounded-glass border p-5 ${
        isCurrent ? "border-glass-border-strong bg-glass-active" : "border-glass-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
            {plan.shortName}
          </p>
          <h2 className="mt-2 font-serif italic text-3xl tracking-tight">{plan.name}</h2>
        </div>
        {isCurrent ? (
          <span className="rounded-full border border-media-fg-55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-kyar-media-fg">
            Current
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-media-fg-70">{plan.tagline}</p>

      <div className="mt-5 border-t border-glass-divider pt-5">
        <p className="font-serif italic text-4xl tracking-tight">
          {plan.payWhatYouWant
            ? `From ${formatUsdPrice(plan.monthlyPriceUsd)}`
            : formatUsdPrice(plan.monthlyPriceUsd)}
          <span className="ml-1 font-sans not-italic text-sm text-media-fg-55">/ mo</span>
        </p>
        <p className="mt-1 text-xs text-media-fg-55">
          {plan.payWhatYouWant
            ? "Pay what you want, billed monthly"
            : isPaid
              ? `${formatUsdPrice(plan.annualPriceUsd)} / year${
                  plan.annualSavingsLabel ? ` - ${plan.annualSavingsLabel}` : ""
                }`
              : "No payment required"}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-glass-divider pt-5">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">Storage</dt>
          <dd className="mt-1 text-sm font-medium">{formatPlanStorage(plan.storageLimitMb)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">Sync</dt>
          <dd className="mt-1 text-sm font-medium">
            {plan.id === "free" ? "Local only" : "All devices"}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-2 text-sm leading-6">
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
    <SettingsGlassShell eyebrow="Settings" title="Subscription plan" maxWidthClass="max-w-[1100px]">
      <div>
        {isLoading && <p className="text-sm text-media-fg-70">Loading…</p>}
        {!isLoading && tier && (
          <section className="space-y-10">
            <div className="rounded-glass border border-glass-border bg-glass-active p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55 mb-1">
                    Current plan
                  </p>
                  <p
                    className="font-serif italic text-3xl tracking-tight"
                    data-testid="subscription-tier"
                  >
                    {currentPlan.name}
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-media-fg-70">
                    {currentPlan.audience}
                  </p>
                </div>
                <div className="min-w-48 rounded-[10px] border border-glass-border px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55 mb-1">
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-2 uppercase">
                    Plans
                  </p>
                  <h2 id="plans-heading" className="font-serif italic text-3xl tracking-tight">
                    Choose the room your studio needs
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-6 text-media-fg-70">
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

            <section className="rounded-glass border border-glass-border bg-glass-active p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55 mb-3">
                What changes when you upgrade
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">Pro stops the busywork</h3>
                  <p className="mt-2 text-sm leading-6 text-media-fg-70">
                    Automatic cloud backup and sync across every device, collaboration invites,
                    advanced planning, and 2 GB of image storage — no manual exports to manage.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Supporter gives back</h3>
                  <p className="mt-2 text-sm leading-6 text-media-fg-70">
                    Exactly the same features as Pro at a contribution amount you choose, for people
                    who want to help fund Kyarafit&rsquo;s ongoing development.
                  </p>
                </div>
              </div>
            </section>

            <section>
              {isFree ? (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold">Upgrade</p>
                  <p className="mt-1 text-[11px] text-media-fg-55">
                    Upgrade for backup, export, collaboration, advanced planning, and more storage.
                  </p>
                </div>
              ) : (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold">
                    Manage subscription
                  </p>
                  <p className="mt-1 text-[11px] text-media-fg-55">
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
          <p className="text-sm text-media-fg-70">Sign in to see your plan.</p>
        )}
      </div>
    </SettingsGlassShell>
  );
}
