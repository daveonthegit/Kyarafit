"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Kyarafit-styled MagicCard: black-only spotlight on border and subtle inner
 * darkening. No gradients or neon; aligns with design system (one accent in
 * chrome, sharp corners via rounded-sm).
 */
interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  /** Size of the spotlight (px). */
  gradientSize?: number;
  /** Inner glow color – black only per design system. */
  gradientColor?: string;
  /** Inner glow opacity – subtle. */
  gradientOpacity?: number;
  /** Border highlight start – black. */
  gradientFrom?: string;
  /** Border highlight end – transparent so only edge glows. */
  gradientTo?: string;
}

const KYAR_BLACK = "#000000";
const KYAR_BORDER = "rgba(0,0,0,0.10)";

export function MagicCard({
  children,
  className,
  gradientSize = 180,
  gradientColor = KYAR_BLACK,
  gradientOpacity = 0.12,
  gradientFrom = KYAR_BLACK,
  gradientTo = "transparent",
}: MagicCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const reset = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = mouseX.get();
    const y = mouseY.get();
    const distances = {
      left: x,
      right: rect.width - x,
      top: y,
      bottom: rect.height - y,
    };
    type Edge = "left" | "right" | "top" | "bottom";
    const entries = Object.entries(distances) as [Edge, number][];
    const closestEdge = entries.reduce(
      (closest, [edge, distance]) => (distance < closest.distance ? { edge, distance } : closest),
      { edge: "left" as Edge, distance: distances.left }
    ).edge;
    switch (closestEdge) {
      case "left":
        animate(mouseX, -gradientSize);
        break;
      case "right":
        animate(mouseX, rect.width + gradientSize);
        break;
      case "top":
        animate(mouseY, -gradientSize);
        break;
      case "bottom":
        animate(mouseY, rect.height + gradientSize);
        break;
      default:
        animate(mouseX, -gradientSize);
        animate(mouseY, -gradientSize);
    }
  }, [gradientSize, mouseX, mouseY]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY]
  );

  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    const handleGlobalPointerOut = (e: PointerEvent) => {
      if (!e.relatedTarget) reset();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") reset();
    };
    window.addEventListener("pointerout", handleGlobalPointerOut);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pointerout", handleGlobalPointerOut);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reset]);

  return (
    <motion.div
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-sm border border-kyar-borderSubtle",
        className
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerEnter={reset}
      style={{
        background: useMotionTemplate`linear-gradient(#FFFFFF 0 0) padding-box,
          radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
            ${gradientFrom},
            ${gradientTo},
            ${KYAR_BORDER} 100%
          ) border-box`,
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)`,
          opacity: gradientOpacity,
        }}
        aria-hidden
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
