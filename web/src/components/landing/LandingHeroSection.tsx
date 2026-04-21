"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { HeroVideoPlayer } from "@/components/landing/remotion/HeroVideoPlayer";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

const easeOutStrong = [0.23, 1, 0.32, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutStrong },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export function LandingHeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  /** Direct scroll coupling (no spring) — springs trail scroll and read as lag. */
  const yHeroMockup = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const opacityHeroMockup = useTransform(scrollYProgress, [0.4, 0.88], [1, 0.38]);

  /** Ground: opacity + scale only. Avoid animating `filter: blur()` on scroll — very expensive. */
  const groundOpacity = useTransform(scrollYProgress, [0, 0.25, 0.55, 1], [0.5, 0.42, 0.22, 0.08]);
  const groundScaleX = useTransform(scrollYProgress, [0, 1], [1, 0.88]);

  const videoMotionStyle = prefersReducedMotion
    ? undefined
    : {
        y: yHeroMockup,
        opacity: opacityHeroMockup,
      };

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-[85svh] flex-col items-center overflow-x-clip overflow-y-visible bg-kyar-bg text-kyar-text pb-14 pt-[max(6.5rem,env(safe-area-inset-top,0px)+4.75rem)] sm:min-h-[90vh] sm:pb-20 sm:pt-36 lg:pb-28 lg:pt-40"
      aria-labelledby="hero-heading"
    >
      <div className={`relative z-10 w-full min-w-0 ${SECTION_PADDING} ${MAX_WIDTH}`}>
        <motion.div
          className="flex w-full flex-col items-center"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.p
            variants={fadeUp}
            className="font-sans-wide mb-5 text-center text-[10px] font-semibold uppercase tracking-widest text-kyar-meta sm:mb-6 sm:text-[11px]"
            aria-hidden
          >
            The Cosplayer&apos;s Digital Toolkit
          </motion.p>
          <motion.h1
            variants={fadeUp}
            id="hero-heading"
            className="font-serif-elegant mx-auto mb-5 max-w-5xl text-balance text-center text-[clamp(2.7rem,8vw,5.5rem)] font-normal italic leading-[1.04] tracking-tight text-kyar-text sm:mb-7"
          >
            Master the craft.
            <br className="hidden sm:block" /> Organize the chaos.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mx-auto mb-8 max-w-[42rem] px-1 text-center text-[clamp(1rem,2.5vw,1.125rem)] leading-relaxed text-kyar-textSecondary sm:mb-10"
          >
            Purpose-built for planning, building, and packing for conventions. Designed for meticulous
            creators who want to drop the spreadsheets.
          </motion.p>
          <motion.div variants={fadeUp} className="mb-10 flex w-full justify-center sm:mb-12 lg:mb-14">
            <LandingAuthCta variant="hero" />
          </motion.div>

          <motion.div variants={fadeUp} className="relative z-0 w-full min-w-0 max-w-[min(100%,82rem)] shrink-0">
            <div className="relative w-full">
              <motion.div
                className="relative mx-auto w-full [transform:translateZ(0)]"
                style={videoMotionStyle}
              >
                <div className="hero-video-frame relative mx-auto flex aspect-video w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-kyar-cardBorder bg-[#0A0A0A] sm:rounded-[2rem]">
                  <HeroVideoPlayer />
                </div>

                {!prefersReducedMotion && (
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-[10%] left-1/2 h-[14%] min-h-[2.5rem] w-[88%] max-w-5xl -translate-x-1/2 rounded-[100%] bg-kyar-text blur-[22px]"
                    style={{
                      opacity: groundOpacity,
                      scaleX: groundScaleX,
                    }}
                  />
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
