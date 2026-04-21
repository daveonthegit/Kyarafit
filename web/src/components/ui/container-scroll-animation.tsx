"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type ContainerScrollVariant = "default" | "compact";

/** Matches personal portfolio revealer: translateY + opacity, cubic-bezier(0.2, 0.8, 0.2, 1), IO thresholds — not scroll-progress-driven 3D (which janks). */
const REVEAL_EASE = [0.2, 0.8, 0.2, 1] as const;
const VIEWPORT = { once: false as const, margin: "0px 0px -8% 0px" as const, amount: 0.12 as const };

export const ContainerScroll = ({
  titleComponent,
  children,
  variant = "default",
  className,
  cardClassName,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
  variant?: ContainerScrollVariant;
  className?: string;
  cardClassName?: string;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const heightClass = variant === "compact" ? "h-[38rem] md:h-[48rem]" : "h-[60rem] md:h-[80rem]";
  const innerPy = variant === "compact" ? "py-6 md:py-16" : "py-10 md:py-40";

  const titleHidden = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 };
  const cardHidden = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 28, scale: isMobile ? 0.92 : 0.97 };

  return (
    <div
      className={`${heightClass} flex items-center justify-center relative p-2 md:p-6 ${className ?? ""}`}
    >
      <div className={`${innerPy} w-full relative`}>
        <motion.div
          initial={titleHidden}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.65, ease: REVEAL_EASE }}
          className="max-w-5xl mx-auto text-center"
        >
          {titleComponent}
        </motion.div>
        <motion.div
          initial={cardHidden}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.72, ease: REVEAL_EASE, delay: 0.05 }}
          className={`max-w-5xl -mt-12 mx-auto h-[24rem] md:h-[32rem] w-full border-4 border-kyar-border p-2 md:p-6 bg-kyar-surface rounded-2xl shadow-soft ${cardClassName ?? ""}`}
          style={{ transformOrigin: "center top" }}
        >
          <div className="h-full w-full overflow-hidden rounded-xl bg-kyar-muted md:rounded-xl md:p-4">
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
