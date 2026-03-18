"use client";

import { cn } from "@/lib/utils";

interface SystemLabelProps {
  children: React.ReactNode;
  prefix?: "//" | "[]" | ">" | "#";
  className?: string;
}

export function SystemLabel({ children, prefix = "//", className }: SystemLabelProps) {
  const formatted =
    prefix === "[]" ? `[${children}]` : prefix === ">" ? `> ${children}` : `${prefix} ${children}`;

  return (
    <span
      className={cn(
        "font-mono text-[10px] font-medium uppercase tracking-mono text-kyar-meta",
        className
      )}
    >
      {formatted}
    </span>
  );
}
