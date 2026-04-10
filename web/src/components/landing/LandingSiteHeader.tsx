"use client";

import Link from "next/link";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

export function LandingSiteHeader() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-kyar-borderSubtle bg-kyar-bg/90 text-kyar-text shadow-sm backdrop-blur-md backdrop-saturate-150"
      aria-label="Site header"
    >
      <div
        className={`mx-auto flex w-full items-center justify-between gap-4 py-4 sm:py-5 lg:py-6 ${SECTION_PADDING} ${MAX_WIDTH}`}
      >
        <Link
          href="/"
          className="font-serif-elegant text-lg font-bold italic tracking-tighter text-kyar-text sm:text-xl lg:text-2xl"
          aria-label="Kyarafit home"
        >
          Kyarafit
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle variant="header" />
          <LandingAuthCta variant="header" />
        </div>
      </div>
    </header>
  );
}
