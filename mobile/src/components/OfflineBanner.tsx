import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

type Props = {
  /** Optional retry handler (e.g. refetch the surface). The banner always offers a re-check action. */
  onRetry?: () => void;
};

/**
 * Non-blocking banner for online-only surfaces (social, groups, billing — REQ-082/101).
 *
 * These surfaces are intentionally never available offline, so when the device is disconnected we
 * surface a clear, non-blocking notice plus a retry affordance instead of failing silently. It
 * renders nothing while online, so callers can mount it unconditionally at the top of the surface.
 */
export function OfflineBanner({ onRetry }: Props) {
  const { t } = useTranslation();
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={t("offline.onlineOnlyBanner")}
      className="flex-row items-center justify-between gap-3 border-b border-kyar-border bg-kyar-accentSoft px-5 py-3 dark:border-kyar-dark-border dark:bg-kyar-dark-accentSoft"
    >
      <Text className="min-w-0 flex-1 text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
        {t("offline.onlineOnlyBanner")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="rounded-full border border-kyar-border px-3 py-1.5 active:opacity-80 dark:border-kyar-dark-border"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
          {t("offline.retry")}
        </Text>
      </Pressable>
    </View>
  );
}
