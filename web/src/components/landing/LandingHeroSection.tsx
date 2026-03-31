"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { HeroVideoPlayer } from "@/components/landing/remotion/HeroVideoPlayer";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

export function LandingHeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const yHeroMockup = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacityHeroMockup = useTransform(scrollYProgress, [0.4, 0.9], [1, 0]);
  const smoothY = useSpring(yHeroMockup, { damping: 20, stiffness: 100 });

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-[85svh] flex-col items-center justify-center overflow-x-clip overflow-y-visible pb-14 pt-[max(6.5rem,env(safe-area-inset-top,0px)+4.75rem)] sm:min-h-[90vh] sm:pb-20 sm:pt-36 lg:pb-28 lg:pt-40"
      aria-labelledby="hero-heading"
    >
      <motion.div
        className={`relative z-10 w-full min-w-0 text-center ${SECTION_PADDING} ${MAX_WIDTH}`}
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.p
          variants={fadeUp}
          className="font-sans-wide mb-5 text-[10px] font-semibold uppercase tracking-widest text-kyar-meta sm:mb-6 sm:text-[11px]"
          aria-hidden
        >
          The Cosplayer&apos;s Digital Toolkit
        </motion.p>
        <motion.h1
          variants={fadeUp}
          id="hero-heading"
          className="font-serif-elegant mx-auto mb-5 max-w-5xl text-balance text-[clamp(2.7rem,8vw,5.5rem)] font-normal leading-[1.04] sm:mb-7"
        >
          Master the craft.
          <br className="hidden sm:block" /> Organize the chaos.
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mx-auto mb-8 max-w-[42rem] px-1 text-[clamp(1rem,2.5vw,1.125rem)] leading-relaxed text-kyar-textSecondary sm:mb-10"
        >
          Purpose-built for planning, building, and packing for conventions. Designed for meticulous
          creators who want to drop the spreadsheets.
        </motion.p>
        <motion.div
          variants={fadeUp}
          className="mb-8 flex w-full justify-center sm:mb-14 sm:w-auto"
        >
          <LandingAuthCta variant="hero" />
        </motion.div>
      </motion.div>

      <motion.div
        style={
          prefersReducedMotion
            ? undefined
            : {
                y: smoothY,
                opacity: opacityHeroMockup,
              }
        }
        className="relative z-0 mt-2 w-full min-w-0 max-w-[min(100%,82rem)] shrink-0 px-4 sm:mt-4 sm:px-6 lg:px-8"
      >
        <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[108%] w-[108%] max-w-[100vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-kyar-accent/10 blur-[72px] sm:blur-[80px]" />
        <div className="relative mx-auto flex aspect-video w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-kyar-border bg-[#0A0A0A] shadow-[0_28px_60px_rgba(17,82,212,0.14)] sm:rounded-[2rem] sm:shadow-[0_40px_80px_rgba(17,82,212,0.15)]">
          <HeroVideoPlayer />
        </div>
      </motion.div>
    </section>
  );
}
