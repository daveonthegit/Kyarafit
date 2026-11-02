"use client";

import { WebAppShell } from "@/components/layout/WebAppShell";

/**
 * Studio-wall backdrop for the deep-link create routes (/builds/new, …). The
 * creation dialog opens over it, so it carries no glass panel of its own —
 * just a quiet status line and a tertiary way back.
 */
export function CreationRoutePlaceholder({
  message,
  cancelLabel,
  onCancel,
}: {
  message: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <WebAppShell fullBleed>
      <div className="relative flex flex-1 flex-col text-kyar-media-fg">
        <div className="absolute inset-0 bg-studio-wall" aria-hidden />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-media-fg-55">
            {message}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="border-b border-kyar-media-fg pb-0.5">{cancelLabel}</span>
          </button>
        </div>
      </div>
    </WebAppShell>
  );
}
