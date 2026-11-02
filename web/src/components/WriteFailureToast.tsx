"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { dismissWriteFailure, writeFailures } from "@/lib/offline/writeFailures";

const VISIBLE_MS = 6000;

/**
 * Transient notice for a web edit that did not save (ADR-0006). Like the offline strip, it shows
 * only while its condition holds (ADR-0002) and replaces the old blocking `window.alert`. It sits
 * above the mobile tab bar and fades in place; reduced motion drops the movement.
 */
export function WriteFailureToast() {
  const t = useTranslations("Sync");
  const failure = useSyncExternalStore(
    writeFailures.subscribe,
    writeFailures.getSnapshot,
    () => null
  );

  useEffect(() => {
    if (!failure) return;
    const timer = window.setTimeout(() => dismissWriteFailure(failure.id), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [failure]);

  if (!failure) return null;
  const message =
    failure.kind === "offline"
      ? t("writeOffline")
      : failure.detail
        ? t("writeFailedReason", { reason: failure.detail })
        : t("writeFailed");

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex justify-center px-4 lg:bottom-8">
      <div
        key={failure.id}
        role="alert"
        className="toast-enter pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-glass-border-overlay bg-[rgb(20_19_32/0.86)] py-2 pl-4 pr-2 text-kyar-media-fg shadow-glass-overlay backdrop-blur-glass-chip"
      >
        <span className="material-symbols-outlined text-lg text-media-fg-70" aria-hidden>
          {failure.kind === "offline" ? "cloud_off" : "error"}
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-5">{message}</p>
        <button
          type="button"
          onClick={() => dismissWriteFailure(failure.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-media-ring"
          aria-label={t("dismiss")}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden>
            close
          </span>
        </button>
      </div>
    </div>
  );
}
