"use client";

import { cn } from "@/lib/utils";

interface GlitchTextProps {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "span" | "p";
  intensity?: "subtle" | "medium" | "bold";
  className?: string;
}

export function GlitchText({
  children,
  as: Tag = "h1",
  intensity = "medium",
  className,
}: GlitchTextProps) {
  const glitchClass =
    intensity === "bold" ? "text-glitch" : intensity === "medium" ? "text-glitch-subtle" : "";

  return <Tag className={cn(glitchClass, className)}>{children}</Tag>;
}
