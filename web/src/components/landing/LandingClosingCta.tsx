"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LandingFooterStrip } from "@/components/landing/LandingFooterStrip";
import { LandingMediaDisclaimer } from "@/components/landing/LandingMediaDisclaimer";
import { onLandingScroll, prefersReducedMotion } from "@/components/landing/landingMotion";

/**
 * S4 · Closing CTA + footer — full-bleed convention photo parallaxing ~0.10×
 * behind the content, centered serif line + the solid pill; footer meta links
 * pinned to the section's bottom scrim.
 */
export function LandingClosingCta() {
  const sectionRef = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    return onLandingScroll(() => {
      const section = sectionRef.current;
      const photo = photoRef.current;
      if (!section || !photo) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // Progress of the section through the viewport, centered on 0.
      const p = (rect.top + rect.height / 2 - vh / 2) / vh;
      photo.style.transform = `translateY(${p * vh * -0.1}px) scale(1.12)`;
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[92svh] flex-col overflow-hidden text-kyar-media-fg"
      aria-label="Get started"
    >
      <div ref={photoRef} className="absolute inset-0 will-change-transform">
        <img src="/mock/convention/ecaf-hero.jpg" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-scrim-page-vertical" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-6 py-24 text-center sm:px-8 lg:px-12">
        <h2 className="font-serif italic font-normal text-[40px] sm:text-[60px] leading-[1] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
          The plan starts tonight.
        </h2>
        <Link
          href="/auth/signup"
          className="mt-8 inline-flex min-h-[48px] items-center rounded-full bg-glass-solid px-7 py-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
        >
          Start planning — free
        </Link>
        <span className="mt-4 text-[9px] font-semibold uppercase tracking-[0.2em] opacity-55">
          Free forever · your data stays yours
        </span>
      </div>

      {/* Footer pinned to the bottom scrim */}
      <footer
        className="relative z-10 mx-auto w-full max-w-7xl border-t border-glass-divider-strong px-6 py-6 sm:px-8 lg:px-12"
        role="contentinfo"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="flex items-baseline gap-4">
            <span className="font-serif italic text-[17px] leading-none">Kyarafit</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
              © {new Date().getFullYear()} · All rights reserved
            </span>
          </p>
          <LandingFooterStrip />
        </div>
        <div className="mt-4">
          <LandingMediaDisclaimer embedded />
        </div>
      </footer>
    </section>
  );
}
