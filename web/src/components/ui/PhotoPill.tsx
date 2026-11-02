"use client";

import { forwardRef } from "react";

type Variant = "solid" | "outline" | "text";
type Size = "md" | "sm";

interface PhotoPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * solid — the ONE primary per view: solid light fill, ink text (QA-3).
   * outline — secondary: glass-outline pill on bar-weight glass.
   * text — tertiary: underlined uppercase meta.
   */
  variant?: Variant;
  /** md = standalone actions (44px tap target); sm = dense in-panel chrome. */
  size?: Size;
  /** Optional leading Material Symbol name (e.g. "add_photo_alternate") */
  icon?: string;
  children: React.ReactNode;
}

const pillSizeClasses: Record<Size, string> = {
  md: "min-h-[44px] px-[22px] py-3 text-[10px]",
  sm: "min-h-[34px] px-4 py-[9px] text-[9px]",
};

const textSizeClasses: Record<Size, string> = {
  md: "text-[10px] pb-0.5",
  sm: "text-[9px] pb-0.5",
};

const variantClasses: Record<Variant, string> = {
  solid: "bg-glass-solid text-glass-ink border-0 rounded-full hover:opacity-90 disabled:opacity-25",
  outline:
    "bg-glass-bar text-kyar-media-fg border border-glass-border-strong rounded-full backdrop-blur-glass-chip hover:bg-glass-active disabled:opacity-25",
  text: "bg-transparent text-kyar-media-fg border-0 border-b border-kyar-media-fg rounded-none hover:opacity-80 focus-visible:border-kyar-accent disabled:opacity-25",
};

/**
 * Button for glass/photo surfaces (surface rule 5). The cream `Button`
 * survives only on standalone legal pages and email.
 */
export const PhotoPill = forwardRef<HTMLButtonElement, PhotoPillProps>(
  ({ variant = "solid", size = "md", icon, className = "", children, ...props }, ref) => {
    const base =
      "inline-flex shrink-0 items-center justify-center gap-2 font-bold uppercase tracking-[0.16em] active:scale-[0.98] disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent";
    const sizing = variant === "text" ? textSizeClasses[size] : pillSizeClasses[size];
    return (
      <button
        ref={ref}
        className={`${base} ${sizing} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {icon && (
          <span
            className={`material-symbols-outlined ${size === "sm" ? "text-[14px]" : "text-[15px]"}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
        {children}
      </button>
    );
  }
);
PhotoPill.displayName = "PhotoPill";
