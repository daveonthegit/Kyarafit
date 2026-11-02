"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { onLandingScroll } from "@/components/landing/landingMotion";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

export function LandingSiteHeader() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    return onLandingScroll((y) => {
      const el = ref.current;
      if (!el) return;
      el.dataset.scrolled = y > 40 ? "true" : "false";
    });
  }, []);

  return (
    <div className="sticky top-0 z-50 h-0 shrink-0">
      <header
        ref={ref}
        className="absolute inset-x-0 top-0 text-kyar-media-fg transition-colors duration-300 data-[scrolled=true]:bg-glass-bar data-[scrolled=true]:backdrop-blur-glass-bar data-[scrolled=true]:border-b data-[scrolled=true]:border-glass-divider-strong"
        aria-label="Site header"
      >
        <div
          className={`mx-auto flex w-full items-center justify-between gap-4 py-4 sm:py-5 ${SECTION_PADDING} ${MAX_WIDTH}`}
        >
          <Link
            href="/"
            className="font-serif text-[21px] font-normal italic leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
            aria-label="Kyarafit home"
          >
            Kyarafit
          </Link>
          <LandingAuthCta variant="header" />
        </div>
      </header>
    </div>
  );
}
