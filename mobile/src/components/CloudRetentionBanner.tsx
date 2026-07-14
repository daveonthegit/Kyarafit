import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { cloudRetentionBanner } from "@kyarafit/design-system/domain/tierTransition";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { useTier } from "@/lib/useTier";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

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
 * Downgrade cloud-retention status banner (DATA_AND_SYNC.md §10, REQ-D96/D97) — mobile mirror of the
 * web `CloudRetentionBanner`.
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
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject ?? null;
  const { data } = useTier(userId);
  const banner = cloudRetentionBanner(data?.downgradedAt ?? null, now);
  if (!banner) return null;

  const date = formatDate(banner.deadline);
  const message =
    banner.phase === "grace"
      ? t("common.cloudGrace", { defaultValue: "Cloud backup active until {{date}}", date })
      : banner.phase === "frozen"
        ? t("common.cloudFrozen", {
            defaultValue: "Cloud backup frozen — resubscribe to keep syncing (removed {{date}})",
            date,
          })
        : t("common.cloudPurgeable", {
            defaultValue: "Cloud backup expired — resubscribe to restore syncing",
          });

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: borderWidth.hairline,
        borderColor: glass.border.default,
        backgroundColor: glass.fallback.overlay,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <Text
        accessibilityRole="text"
        style={{
          textAlign: "center",
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 12,
          color: glass.text.fg,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
