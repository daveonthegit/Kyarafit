import Link from "next/link";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { LandingDeviceShowcaseSection } from "@/components/landing/LandingDeviceShowcaseSection";
import { LandingFooterStrip } from "@/components/landing/LandingFooterStrip";
import { LandingHeroSection } from "@/components/landing/LandingHeroSection";
import { LandingMediaDisclaimer } from "@/components/landing/LandingMediaDisclaimer";
import { LandingProductScrollySection } from "@/components/landing/LandingProductScrollySection";
import { LandingWorkflowSection } from "@/components/landing/LandingWorkflowSection";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-kyar-bgWarm text-kyar-text overflow-x-clip selection:bg-kyar-accent selection:text-white">
      <header
        className={`fixed top-0 left-0 right-0 flex justify-between items-center py-6 z-50 mix-blend-difference text-white ${SECTION_PADDING} ${MAX_WIDTH}`}
        aria-label="Site header"
      >
        <Link
          href="/"
          className="font-serif-elegant text-xl sm:text-2xl font-bold italic tracking-tighter"
          aria-label="Kyarafit home"
        >
          Kyarafit
        </Link>
        <LandingAuthCta variant="header" />
      </header>

      <main className="flex flex-col" role="main">
        <LandingHeroSection />
        <LandingProductScrollySection />
        <LandingWorkflowSection />
        <LandingDeviceShowcaseSection />
      </main>

      <footer className="border-t border-kyar-borderSubtle bg-kyar-bgWarm" role="contentinfo">
        <div className={`${SECTION_PADDING} ${MAX_WIDTH} py-10`}>
          <LandingMediaDisclaimer embedded />
          <div className="mt-8 flex flex-col gap-4 border-t border-kyar-borderSubtle pt-8 sm:flex-row sm:items-center sm:justify-between">
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
