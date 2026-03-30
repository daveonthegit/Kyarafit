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
      className="relative flex min-h-[85svh] flex-col items-center justify-center overflow-x-clip overflow-y-visible pb-16 pt-[max(7.5rem,env(safe-area-inset-top,0px)+5.5rem)] sm:min-h-[90vh] sm:pb-24 sm:pt-40 lg:pb-32"
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
          className="font-serif-elegant mx-auto mb-6 max-w-4xl text-balance text-4xl font-normal leading-[1.08] sm:mb-8 sm:text-6xl lg:text-[5.5rem]"
        >
          Master the craft.
          <br className="hidden sm:block" /> Organize the chaos.
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="mx-auto mb-10 max-w-2xl px-1 text-base leading-relaxed text-kyar-textSecondary sm:mb-12 sm:text-lg"
        >
          Purpose-built for planning, building, and packing for conventions. Designed for
          meticulous creators who want to drop the spreadsheets.
        </motion.p>
        <motion.div variants={fadeUp} className="mb-10 flex justify-center sm:mb-16">
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
        className="relative z-0 mt-2 w-full min-w-0 max-w-[min(100%,80rem)] shrink-0 px-3 sm:mt-4 sm:px-6"
      >
        <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[110%] w-[110%] max-w-[100vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-kyar-accent/10 blur-[80px]" />
        <div className="relative mx-auto flex aspect-video w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-kyar-border bg-[#0A0A0A] shadow-[0_40px_80px_rgba(17,82,212,0.15)] sm:rounded-[2rem]">
          <HeroVideoPlayer />
        </div>
      </motion.div>
    </section>
  );
}
