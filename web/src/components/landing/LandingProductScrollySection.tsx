"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { LandingMiniAppFrame, type NavKey } from "@/components/landing/LandingMiniAppFrame";
import { LandingMiniBuildsPreviewContent } from "@/components/landing/LandingMiniBuildsPreview";
import { LandingMiniBuildTrackingPreviewContent } from "@/components/landing/LandingMiniBuildTrackingPreview";
import { LandingMiniElementsPreviewContent } from "@/components/landing/LandingMiniElementsPreview";
import { ConventionLandingPreview } from "@/components/conventions/ConventionLandingPreview";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  LANDING_BUILDS,
  LANDING_BUILD_TASKS,
  LANDING_NODES,
  MOCK_ACCOUNT,
} from "@/data/landingMock";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

const STEPS = [
  {
    eyebrow: "Builds",
    title: "Every project on one screen.",
    headingId: "builds-heading",
  },
  {
    eyebrow: "Elements",
    title: "Your closet, ready to reuse.",
    headingId: "elements-heading",
  },
  {
    eyebrow: "Conventions",
    title: "Weekend plans, day by day.",
    headingId: "conventions-heading",
  },
  {
    eyebrow: "Tasks",
    title: "Build tasks and progress in sync.",
    headingId: "tracking-heading",
  },
] as const;

const NAV_BY_STEP: NavKey[] = ["builds", "elements", "conventions", "tasks"];

/** Shared easing for product scrolly motion (matches prior CSS cubic-bezier). */
const SLIDE_EASE = [0.22, 1, 0.36, 1] as const;

const COPY_FADE_DURATION = 0.38;
const PANEL_SLIDE_DURATION = 0.58;

function StepDescription({ step }: { step: number }) {
  switch (step) {
    case 0:
      return (
        <p className="max-w-xl text-base leading-relaxed text-kyar-textSecondary sm:text-lg">
          Browse and filter your cosplay builds the way you will in the app: cards, cover art, and
          status at a glance—no sign-in required on this preview.
        </p>
      );
    case 1:
      return (
        <p className="max-w-xl text-base leading-relaxed text-kyar-textSecondary sm:text-lg">
          Elements are the pieces you own—wigs, props, contacts, materials—with photos and filters
          so you can attach them to builds without digging through folders.
        </p>
      );
    case 2:
      return (
        <p className="max-w-xl text-base leading-relaxed text-kyar-textSecondary sm:text-lg">
          For each convention, see your lineup by day, which build you wear when, and a packing list
          so nothing stays in the hotel room by mistake.
        </p>
      );
    case 3:
      return (
        <p className="max-w-xl text-base leading-relaxed text-kyar-textSecondary sm:text-lg">
          Inside a build, tasks and checklists track construction: what’s done, what’s next, and how
          far along the project is—same idea as the real build detail screen.
        </p>
      );
    default:
      return null;
  }
}

const STEP_COUNT = STEPS.length;

/**
 * Map scroll progress [0,1] through the section to a step.
 * With `position: sticky`, the panel only stays pinned while the section extends below the viewport.
 * After the last step (Tasks) activates, any further scroll still moves the sticky block upward until
 * the section ends—so a long "tail" after switching to Tasks hides the headline. Keep the Tasks
 * segment to the final ~10% of scroll (p ≥ 0.9) so most Tasks viewing happens before that tail.
 */
function updateStepFromScroll(container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  const vh = window.innerHeight;
  const totalScrollable = container.offsetHeight - vh;
  const scrolledPastTop = -rect.top;
  if (totalScrollable <= 0) {
    return 0;
  }
  const p = Math.min(1, Math.max(0, scrolledPastTop / totalScrollable));
  if (p < 0.3) return 0;
  if (p < 0.6) return 1;
  if (p < 0.9) return 2;
  return 3;
}

/** Midpoint scroll progress for each step — must fall inside the bands in {@link updateStepFromScroll}. */
const STEP_SCROLL_P: readonly number[] = [0.12, 0.45, 0.75, 0.95];

function scrollWindowToProductStep(sectionEl: HTMLElement, stepIndex: number) {
  const vh = window.innerHeight;
  const totalScrollable = sectionEl.offsetHeight - vh;
  if (totalScrollable <= 0) return;
  const p = STEP_SCROLL_P[stepIndex] ?? STEP_SCROLL_P[0];
  const sectionTopDoc = sectionEl.getBoundingClientRect().top + window.scrollY;
  const targetY = sectionTopDoc + p * totalScrollable;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

/**
 * Scroll-driven product tour: left copy crossfades; right mock slides horizontally with smooth motion.
 * One {@link LandingMiniAppFrame}; inner panels are a horizontal strip Builds → Elements → Conventions → Tasks.
 */
export function LandingProductScrollySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const isDesktopScrolly = useMediaQuery("(min-width: 1024px)");

  const handleMiniAppNav = useCallback(
    (key: NavKey) => {
      const el = containerRef.current;
      if (!el) return;
      const stepIndex = NAV_BY_STEP.indexOf(key);
      if (stepIndex < 0) return;
      setStep(stepIndex);
      if (isDesktopScrolly) {
        scrollWindowToProductStep(el, stepIndex);
      }
    },
    [isDesktopScrolly]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isDesktopScrolly) return;

    let frameId: number | null = null;

    const tick = () => {
      frameId = null;
      setStep((currentStep) => {
        const nextStep = updateStepFromScroll(el);
        return currentStep === nextStep ? currentStep : nextStep;
      });
    };

    const scheduleTick = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(tick);
    };

    scheduleTick();
    window.addEventListener("scroll", scheduleTick, { passive: true });
    window.addEventListener("resize", scheduleTick);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleTick);
      window.removeEventListener("resize", scheduleTick);
    };
  }, [isDesktopScrolly]);

  const slidePct = step * (100 / STEP_COUNT);
  const copyTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: COPY_FADE_DURATION, ease: SLIDE_EASE };
  const panelTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { duration: PANEL_SLIDE_DURATION, ease: SLIDE_EASE };

  return (
    <section
      ref={containerRef}
      id="product-demo"
      className="relative scroll-mt-20 border-t border-kyar-borderSubtle bg-kyar-bg lg:min-h-[288vh] lg:scroll-mt-24"
      aria-label="Product preview"
    >
      <div className="flex w-full min-h-0 flex-col justify-start py-8 sm:py-10 lg:sticky lg:top-20 lg:z-10 lg:py-10">
        <div
          className={`${SECTION_PADDING} ${MAX_WIDTH} grid grid-cols-1 items-start gap-8 md:gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 xl:gap-16`}
        >
          <div className="flex min-h-0 w-full flex-col justify-center lg:py-6">
            <div className="mb-5 flex flex-wrap gap-2 lg:hidden" aria-label="Preview steps">
              {STEPS.map((s, i) => (
                <button
                  key={s.headingId}
                  type="button"
                  onClick={() => handleMiniAppNav(NAV_BY_STEP[i])}
                  className={`min-h-[2.5rem] rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 ${
                    i === step
                      ? "border-kyar-text bg-kyar-text text-kyar-bg"
                      : "border-kyar-borderSubtle bg-kyar-surface text-kyar-textSecondary hover:border-kyar-text/30 hover:text-kyar-text"
                  }`}
                  aria-pressed={i === step}
                >
                  {s.eyebrow}
                </button>
              ))}
            </div>
            <div className="flex gap-3 sm:gap-5">
              <div
                className="hidden shrink-0 flex-col justify-between gap-2 py-1 lg:flex"
                style={{ minHeight: "12rem" }}
                aria-hidden
              >
                {STEPS.map((s, i) => (
                  <span
                    key={s.headingId}
                    className={`w-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      i === step ? "bg-kyar-accent" : "bg-kyar-borderSubtle"
                    }`}
                  />
                ))}
              </div>
              <div className="min-h-[12.5rem] min-w-0 flex-1 overflow-hidden sm:min-h-[14rem] lg:min-h-[min(22rem,44vh)]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={STEPS[step].headingId}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                    transition={copyTransition}
                    className="will-change-[opacity,transform]"
                  >
                    <p className="font-sans-wide mb-4 text-xs font-semibold uppercase tracking-widest text-kyar-accent">
                      {STEPS[step].eyebrow}
                    </p>
                    <h2
                      id={STEPS[step].headingId}
                      className="font-serif-elegant mb-4 max-w-2xl text-[clamp(2rem,5vw,3rem)] font-normal leading-[1.05] text-kyar-text"
                    >
                      {STEPS[step].title}
                    </h2>
                    <StepDescription step={step} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="w-full min-w-0">
            <div className="relative mx-auto w-full">
              <LandingMiniAppFrame
                activeNav={NAV_BY_STEP[step]}
                mainClassName="min-h-[clamp(24rem,72vw,34rem)] overflow-hidden lg:min-h-[min(560px,72vh)]"
                onNavSelect={handleMiniAppNav}
              >
                <div className="overflow-hidden">
                  <motion.div
                    className="flex w-[400%] will-change-transform"
                    initial={false}
                    animate={{ x: `-${slidePct}%` }}
                    transition={panelTransition}
                  >
                    <div className="w-1/4 min-w-0 shrink-0 overflow-x-hidden">
                      <LandingMiniBuildsPreviewContent builds={LANDING_BUILDS} />
                    </div>
                    <div className="w-1/4 min-w-0 shrink-0 overflow-x-hidden">
                      <LandingMiniElementsPreviewContent nodes={LANDING_NODES} />
                    </div>
                    <div className="w-1/4 min-w-0 shrink-0 overflow-x-hidden">
                      <ConventionLandingPreview convention={MOCK_ACCOUNT.convention} />
                    </div>
                    <div className="w-1/4 min-w-0 shrink-0 overflow-x-hidden">
                      <LandingMiniBuildTrackingPreviewContent tasks={LANDING_BUILD_TASKS} />
                    </div>
                  </motion.div>
                </div>
              </LandingMiniAppFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
