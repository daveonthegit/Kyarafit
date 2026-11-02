"use client";

import { useTranslations } from "next-intl";
import { cloudRetentionBanner } from "@kyarafit/design-system/domain/tierTransition";
import { useTier } from "@/lib/api/useTier";

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Downgrade cloud-retention status banner (DATA_AND_SYNC.md §10, REQ-D96/D97).
 *
 * INFORMATIONAL only: it tells a downgraded (now free) user the state of their CLOUD backup —
 * `grace` (kept intact until a date), `frozen` (read-only; resubscribe to keep syncing, with a purge
 * date), or `purgeable` (may already be removed). It NEVER blocks the app or local editing — local
 * on-device data is always fully editable offline. Renders nothing for a user who never downgraded
 * (or re-subscribed): `cloudRetentionBanner` returns `null` when `downgradedAt` is unset.
 *
 * `now` is injectable for deterministic tests (defaults to `Date.now()`).
 */
export function CloudRetentionBanner({ now = Date.now() }: { now?: number }) {
  const t = useTranslations("Sync");
  const { data } = useTier();
  const banner = cloudRetentionBanner(data?.downgradedAt ?? null, now);
  if (!banner) return null;

  const date = formatDate(banner.deadline);
  const message =
    banner.phase === "grace"
      ? t("cloudGrace", { date })
      : banner.phase === "frozen"
        ? t("cloudFrozen", { date })
        : t("cloudPurgeable");

  // Transient glass strip (ADR-0002): full-width inset on mobile, stacked above the tab bar, the
  // mobile FAB (tops out at ~9rem) and the write-failure toast's lane (toast: centered, max-w-md, 5.5rem mobile / 2rem lg,
  // z-60). Right-aligned from lg; it stays raised until xl, where the right lane clears the
  // centered toast's widest footprint.
  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-enter fixed inset-x-4 bottom-[calc(9.75rem+env(safe-area-inset-bottom,0px))] z-40 flex items-start gap-3 rounded-[12px] border border-glass-border-overlay bg-[rgb(20_19_32/0.86)] px-4 py-3 text-kyar-media-fg shadow-glass-overlay backdrop-blur-glass-chip lg:inset-x-auto lg:bottom-24 lg:right-8 lg:max-w-xs xl:bottom-8"
    >
      <span className="material-symbols-outlined text-lg text-media-fg-70" aria-hidden>
        cloud_off
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-5">{message}</p>
    </div>
  );
}
