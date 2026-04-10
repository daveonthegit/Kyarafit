import { LandingDeviceShowcaseSection } from "@/components/landing/LandingDeviceShowcaseSection";
import { LandingFooterStrip } from "@/components/landing/LandingFooterStrip";
import { LandingHeroSection } from "@/components/landing/LandingHeroSection";
import { LandingMediaDisclaimer } from "@/components/landing/LandingMediaDisclaimer";
import { LandingProductScrollySection } from "@/components/landing/LandingProductScrollySection";
import { LandingWorkflowSection } from "@/components/landing/LandingWorkflowSection";
import { LandingSiteHeader } from "@/components/landing/LandingSiteHeader";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-kyar-bg text-kyar-text overflow-x-clip selection:bg-kyar-accent selection:text-kyar-bg">
      <LandingSiteHeader />

      <main className="flex flex-col" role="main">
        <LandingHeroSection />
        <LandingProductScrollySection />
        <LandingWorkflowSection />
        <LandingDeviceShowcaseSection />
      </main>

      <footer className="border-t border-kyar-borderSubtle bg-kyar-bg" role="contentinfo">
        <div className={`${SECTION_PADDING} ${MAX_WIDTH} py-8 sm:py-10`}>
          <LandingMediaDisclaimer embedded />
          <div className="mt-6 flex flex-col gap-4 border-t border-kyar-borderSubtle pt-6 sm:mt-8 sm:pt-8 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-kyar-textTertiary">
              © {new Date().getFullYear()} Kyarafit. All rights reserved.
            </p>
            <LandingFooterStrip />
          </div>
        </div>
      </footer>
    </div>
  );
}
