"use client";

import { useRef, useState, useEffect } from "react";
import { AnimatePresence, motion, useInView, type MotionProps, type Variants } from "framer-motion";

interface BlurFadeProps extends Omit<MotionProps, "variants"> {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y?: number; x?: number; opacity: number; filter?: string };
    visible: { y?: number; x?: number; opacity: number; filter?: string };
  };
  /** Duration in seconds. Design system: subtle motion (short). */
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  inView?: boolean;
  /** Margin for in-view trigger (e.g. "-40px" or "0px"). */
  inViewMargin?: string;
  /** Blur amount when hidden. Kept subtle per design lint. */
  blur?: string;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefersReducedMotion;
}

const getFilter = (v: Variants[string]) =>
  typeof v === "function" ? undefined : (v as { filter?: string })?.filter;

/**
 * Blur-fade entrance. Redesigned for Kyarafit: shorter duration, subtle blur,
 * and respects prefers-reduced-motion (opacity/translate only, no blur).
 */
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.25,
  delay = 0,
  offset = 4,
  direction = "down",
  inView = false,
  inViewMargin = "-40px",
  blur = "4px",
  ...props
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inViewResult = useInView(ref, {
    once: true,
    ...(inViewMargin != null && { margin: inViewMargin as `${number}px` }),
  });
  const isInView = !inView || inViewResult;
  const reduceMotion = usePrefersReducedMotion();

  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const offsetValue = direction === "right" || direction === "down" ? -offset : offset;
  const effectiveBlur = reduceMotion ? "0px" : blur;
  const effectiveDuration = reduceMotion ? 0.1 : duration;

  const defaultVariants: Variants = {
    hidden: {
      [axis]: offsetValue,
      opacity: 0,
      filter: `blur(${effectiveBlur})`,
    },
    visible: {
      [axis]: 0,
      opacity: 1,
      filter: "blur(0px)",
    },
  };
  const combinedVariants = variant ?? defaultVariants;

  const hiddenFilter = getFilter(combinedVariants.hidden);
  const visibleFilter = getFilter(combinedVariants.visible);
  const shouldTransitionFilter =
    hiddenFilter != null && visibleFilter != null && hiddenFilter !== visibleFilter;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.02 + delay,
          duration: effectiveDuration,
          ease: [0.2, 0.8, 0.2, 1],
          ...(shouldTransitionFilter ? { filter: { duration: effectiveDuration } } : {}),
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
