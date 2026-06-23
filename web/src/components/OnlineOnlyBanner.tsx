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
export function OnlineOnlyBanner({ className = "" }: { className?: string }) {
  const { isOnline, recheck } = useIsOnline();
  const t = useTranslations("Social");

  if (isOnline) return null;

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
