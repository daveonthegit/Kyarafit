"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  SUBSCRIPTION_PLANS,
  formatPlanStorage,
  formatUsdPrice,
  type SubscriptionPlan,
} from "@kyarafit/design-system/domain/subscriptionPlans";
import { observeReveal } from "@/components/landing/landingMotion";

/**
 * S3 · Pricing — real tiers from subscriptionPlans.ts (never hardcoded).
 * One bordered container, three divided columns (no nested cards), Pro
 * highlighted; columns stagger-reveal.
 */

function planCtaFor(plan: SubscriptionPlan): { label: string; solid: boolean } {
  if (plan.id === "free") return { label: "Start free", solid: false };
  if (plan.payWhatYouWant) return { label: "Support us", solid: false };
  return { label: "Go Pro", solid: true };
}

function PricingColumn({ plan, index }: { plan: SubscriptionPlan; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => observeReveal(ref.current), []);

  const isPro = plan.id !== "free" && !plan.payWhatYouWant;
  const cta = planCtaFor(plan);

  return (
    <div
      ref={ref}
      className={`landing-reveal flex flex-col px-7 py-8 lg:py-10 ${
        isPro ? "bg-[rgb(255_253_248/0.07)]" : ""
      }`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-55">
          {plan.shortName}
        </span>
        {isPro && (
          <span className="rounded-full bg-on-glass-chip-active-bg px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-chip-active-fg">
            Most popular
          </span>
        )}
      </div>
      <h3 className="mt-3 font-serif italic text-3xl tracking-tight">{plan.name}</h3>
      <p className="mt-3 font-serif italic text-4xl tracking-tight">
        {plan.payWhatYouWant
          ? `From ${formatUsdPrice(plan.monthlyPriceUsd)}`
          : formatUsdPrice(plan.monthlyPriceUsd)}
        <span className="ml-1 font-sans not-italic text-sm text-media-fg-55">/ mo</span>
      </p>
      <p className="mt-1 text-xs text-media-fg-55">
        {plan.payWhatYouWant
          ? "Pay what you want, billed monthly"
          : plan.id === "free"
            ? "No payment required"
            : `${formatUsdPrice(plan.annualPriceUsd)} / year${
                plan.annualSavingsLabel ? ` · ${plan.annualSavingsLabel}` : ""
              }`}
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-[13px] leading-relaxed text-media-fg-70">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2.5">
            <span className="material-symbols-outlined mt-0.5 text-[15px] opacity-70" aria-hidden>
              check
            </span>
            <span>{highlight}</span>
          </li>
        ))}
        <li className="flex gap-2.5">
          <span className="material-symbols-outlined mt-0.5 text-[15px] opacity-70" aria-hidden>
            database
          </span>
          <span>{formatPlanStorage(plan.storageLimitMb)} image storage</span>
        </li>
      </ul>
      <div className="mt-8">
        {cta.solid ? (
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[44px] items-center rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            {cta.label}
          </Link>
        ) : (
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="border-b border-kyar-media-fg pb-0.5">{cta.label}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

export function LandingPricing() {
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => observeReveal(headerRef.current), []);

  return (
    <section
      className="relative overflow-hidden bg-studio-wall py-20 text-kyar-media-fg sm:py-28"
      aria-label="Pricing"
    >
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12">
        <div ref={headerRef} className="landing-reveal max-w-[640px]">
          <span className="block text-[10px] font-bold uppercase tracking-[0.28em] opacity-55 mb-4">
            Pricing
          </span>
          <h2 className="font-serif italic font-normal text-[36px] sm:text-[48px] leading-[1] tracking-[-0.02em]">
            Priced like a coffee. Not like software.
          </h2>
          <p className="mt-4 max-w-[440px] text-[15px] leading-relaxed text-media-fg-70">
            The planner is free forever and local-first. Paying adds cloud sync and backup — and
            keeps Kyarafit independent.
          </p>
        </div>

        <div className="mt-12 grid overflow-hidden rounded-glass border border-glass-border lg:grid-cols-3 lg:divide-x divide-y lg:divide-y-0 divide-glass-divider">
          {SUBSCRIPTION_PLANS.map((plan, index) => (
            <PricingColumn key={plan.id} plan={plan} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
