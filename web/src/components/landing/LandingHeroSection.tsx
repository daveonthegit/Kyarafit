"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { onLandingScroll, prefersReducedMotion } from "@/components/landing/landingMotion";

/**
 * S1 · Hero — full-bleed dark cosplay photo with a cinematic scroll exit
 * (Landing Live spec): the photo zooms 1→1.12 and drifts down ~0.22×vh while
 * the copy eases up −60px and fades out by ~0.7 vh. Disabled under
 * prefers-reduced-motion.
 */
export function LandingHeroSection() {
  const photoRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    return onLandingScroll((y) => {
      const vh = window.innerHeight || 1;
      const p = Math.min(y / (vh * 0.7), 1);
      if (photoRef.current) {
        photoRef.current.style.transform = `scale(${1 + 0.12 * p}) translateY(${0.22 * p * vh}px)`;
      }
      if (copyRef.current) {
        copyRef.current.style.transform = `translateY(${-60 * p}px)`;
        copyRef.current.style.opacity = String(1 - p);
      }
      if (cueRef.current) {
        cueRef.current.style.opacity = String(Math.max(0, 1 - p * 2.5));
      }
    });
  }, []);

  return (
    <section className="relative h-[100svh] overflow-hidden text-kyar-media-fg" aria-label="Intro">
      <div ref={photoRef} className="absolute inset-0 will-change-transform">
        {/* Marketing-only imagery: provenance covered by LandingMediaDisclaimer */}
        <img
          src="/images/mock/builds/Sunday.jpg"
          alt=""
          className="h-full w-full object-cover object-[center_16%]"
        />
      </div>
      <div className="absolute inset-0 bg-scrim-page-right" aria-hidden />
      <div className="absolute inset-0 bg-scrim-page-vertical" aria-hidden />

      <div
        ref={copyRef}
        className="absolute inset-x-0 bottom-[16svh] mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12 will-change-transform"
      >
        <span className="block text-[10px] font-bold uppercase tracking-[0.3em] opacity-75 mb-4">
          The cosplay studio planner
        </span>
        <h1 className="max-w-[13ch] font-serif italic font-normal text-[clamp(56px,7.5vw,100px)] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
          Made by hand.
          <br />
          Planned to the seam.
        </h1>
        <p className="mt-5 max-w-[420px] text-base leading-relaxed opacity-80">
          Every element, task, and convention day for your next build — tracked in one quiet studio
          that works offline.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[44px] items-center rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            Start planning — free
          </Link>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] opacity-55">
            Free forever · works offline
          </span>
        </div>
      </div>

      {/* Quiet scroll cue */}
      <div
        ref={cueRef}
        className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        aria-hidden
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-55">Scroll</span>
        <span className="h-8 w-px bg-gradient-to-b from-kyar-media-fg/60 to-transparent" />
      </div>
    </section>
  );
}
