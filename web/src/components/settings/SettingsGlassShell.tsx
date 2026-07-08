"use client";

import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";

/**
 * Shared frame for settings sub-pages (ref 11a): studio wall, back bar, and
 * ONE centered glass work panel with an eyebrow + serif header. Children
 * render light-on-glass inside the panel body.
 */
export function SettingsGlassShell({
  eyebrow,
  title,
  backHref = "/settings",
  backLabel = "Back to settings",
  maxWidthClass = "max-w-[600px]",
  children,
}: {
  eyebrow: string;
  title: string;
  backHref?: string;
  backLabel?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}) {
  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <div className="absolute inset-0 bg-studio-wall" aria-hidden />

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl" aria-hidden>
              arrow_back
            </span>
          </Link>
        </div>

        <main
          className={`relative z-10 mx-auto mb-16 mt-4 w-full ${maxWidthClass} px-4 sm:px-6 flex-1`}
        >
          <div className="bg-glass backdrop-blur-glass border border-glass-border rounded-glass">
            <div className="px-6 py-5 sm:px-8 border-b border-glass-divider-strong">
              <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-2">
                {eyebrow}
              </span>
              <h1 className="font-serif italic text-[30px] font-normal tracking-[-0.01em]">
                {title}
              </h1>
            </div>
            <div className="px-6 py-5 sm:px-8">{children}</div>
          </div>
        </main>
      </div>
    </WebAppShell>
  );
}
