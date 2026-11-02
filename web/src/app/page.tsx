import { LandingBeforeAfter } from "@/components/landing/LandingBeforeAfter";
import { LandingClosingCta } from "@/components/landing/LandingClosingCta";
import { LandingHeroSection } from "@/components/landing/LandingHeroSection";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingSiteHeader } from "@/components/landing/LandingSiteHeader";

/**
 * Landing (Landing Live spec): four scroll-driven sections on the app's
 * glass language — hero → before/after → pricing → closing CTA. Cream is
 * retired from the marketing site; it's a planner, never an "archive".
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-studio-wall text-kyar-media-fg overflow-x-clip">
      <LandingSiteHeader />

      <main className="flex flex-col" role="main">
        <LandingHeroSection />
        <LandingBeforeAfter />
        <LandingPricing />
        <LandingClosingCta />
      </main>
    </div>
  );
}
