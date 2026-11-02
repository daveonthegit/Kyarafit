"use client";

import { useTranslations } from "next-intl";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * Non-blocking banner for online-only surfaces (social, groups, billing, public pages —
 * PRODUCT_SPEC.md §5 REQ-082/101). Renders nothing while connected; when offline it
 * explains the surface needs a connection and offers a retry. It never blocks viewing
 * cached content and never crashes — write controls remain the responsibility of the
 * surface, which should treat them as unavailable while this banner is shown.
 */
export function OnlineOnlyBanner({
  className = "",
  surface = "cream",
}: {
  className?: string;
  /** "glass" = compact panel-header strip on glass surfaces (ref 12) */
  surface?: "cream" | "glass";
}) {
  const { isOnline, recheck } = useIsOnline();
  const t = useTranslations("Social");

  if (isOnline) return null;

  if (surface === "glass") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-3 rounded-[10px] border border-glass-border bg-glass-bar px-4 py-2.5 text-kyar-media-fg ${className}`.trim()}
      >
        <span className="material-symbols-outlined text-lg text-media-fg-55" aria-hidden>
          cloud_off
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-media-fg-70">{t("offlineTitle")}</p>
        <button
          type="button"
          onClick={recheck}
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-sm border border-kyar-borderSubtle bg-kyar-muted px-4 py-3 text-kyar-text ${className}`.trim()}
    >
      <span className="material-symbols-outlined text-xl text-kyar-textTertiary" aria-hidden>
        cloud_off
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{t("offlineTitle")}</p>
        <p className="text-xs text-kyar-textTertiary mt-0.5">{t("offlineMessage")}</p>
      </div>
      <button
        type="button"
        onClick={recheck}
        className="shrink-0 self-center rounded-sm border border-kyar-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-kyar-text transition-colors hover:bg-kyar-text hover:text-kyar-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
      >
        {t("retry")}
      </button>
    </div>
  );
}
