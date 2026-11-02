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

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 flex max-w-xs items-start gap-3 rounded-sm border border-kyar-borderSubtle bg-kyar-muted px-4 py-3 text-kyar-text shadow-sm"
    >
      <span className="material-symbols-outlined text-xl text-kyar-textTertiary" aria-hidden>
        cloud_off
      </span>
      <p className="min-w-0 flex-1 text-xs font-medium">{message}</p>
    </div>
  );
}
