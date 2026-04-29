"use client";

import Link from "next/link";
import {
  AD_POLICY,
  getSponsoredPlacement,
  shouldShowAdsForTier,
} from "@kyarafit/design-system/domain/adPolicy";
import { useTier } from "@/lib/api/useTier";
import { getAdsenseClient, getAdsenseSidebarSlot } from "@/lib/adsense";
import { GoogleAdsenseUnit } from "./GoogleAdsenseUnit";

export function SponsoredAdRail() {
  const { data: tier, isLoading } = useTier();
  if (isLoading || !tier || !shouldShowAdsForTier(tier.tier)) return null;

  const placement = getSponsoredPlacement("web_sidebar");
  const adsenseClient = getAdsenseClient();
  const adsenseSlot = getAdsenseSidebarSlot();
  const canRenderAdsense = Boolean(adsenseClient && adsenseSlot);

  return (
    <aside
      aria-label={`${AD_POLICY.label}: ${placement.title}`}
      className="sticky top-0 hidden h-screen w-[156px] shrink-0 border-l border-kyar-borderSubtle bg-kyar-bg/85 px-4 py-6 backdrop-blur lg:flex xl:w-[184px]"
    >
      <div className="flex h-full w-full flex-col justify-center">
        <div className="border-y border-kyar-borderSubtle py-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-kyar-textSecondary">
              {AD_POLICY.label}
            </p>
            <span className="text-[9px] uppercase tracking-widest text-kyar-textTertiary">Ad</span>
          </div>
          {canRenderAdsense ? (
            <div className="mt-4 min-h-[280px] w-full overflow-hidden [&_.adsbygoogle[data-ad-status='unfilled']]:hidden">
              <GoogleAdsenseUnit
                client={adsenseClient!}
                slot={adsenseSlot!}
                className="min-h-[280px] w-full"
                layoutKey="web-sidebar"
              />
            </div>
          ) : (
            <>
              <p className="mt-4 text-[10px] uppercase tracking-widest text-kyar-meta">
                {placement.eyebrow}
              </p>
              <h2 className="mt-3 font-serif text-lg italic leading-tight text-kyar-text">
                {placement.title}
              </h2>
              <p className="mt-3 text-xs leading-5 text-kyar-textSecondary">{placement.body}</p>
              <Link
                href={placement.href}
                className="mt-4 inline-flex text-[10px] font-semibold uppercase tracking-widest text-kyar-text underline decoration-kyar-borderSubtle underline-offset-4"
              >
                {placement.cta}
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
