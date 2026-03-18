"use client";

import { cn } from "@/lib/utils";

interface PanelWindowProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  variant?: "default" | "glass";
}

export function PanelWindow({ children, title, className, variant = "default" }: PanelWindowProps) {
  const baseClass =
    variant === "glass"
      ? "glass-panel rounded-sm overflow-hidden"
      : "bg-kyar-surface border border-kyar-borderSubtle rounded-sm overflow-hidden";

  return (
    <div className={cn(baseClass, className)}>
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-kyar-borderSubtle bg-kyar-muted/50">
          <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-kyar-textTertiary">
            {title}
          </span>
          <div className="flex gap-1.5" aria-hidden>
            <span className="w-2 h-2 rounded-full bg-kyar-accent/30" />
            <span className="w-2 h-2 rounded-full bg-kyar-accentCyan/30" />
            <span className="w-2 h-2 rounded-full bg-kyar-textTertiary/30" />
          </div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
