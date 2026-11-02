import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { APP_HREF } from "@/lib/appRoutes";

type Props = {
  /** Explains the paid benefit being gated (e.g. "Creating a group is a paid feature."). */
  message: string;
  /** Optional CTA label; defaults to the shared "View plans" string. */
  ctaLabel?: string;
};

/**
 * Non-blocking upgrade affordance for paid social/groups actions (REQ-022). Mirrors the web
 * `UpgradePrompt`: it explains the paid benefit and links to the subscription screen. It never
 * blocks or destroys local work — it simply offers the upgrade path for cloud-cost features
 * (publishing, posting, group creation — REQ-017/018/019).
 */
export function UpgradeNotice({ message, ctaLabel }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={t("upgrade.regionLabel")}
      className="rounded-3xl border border-kyar-borderSubtle bg-kyar-muted px-4 py-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted"
    >
      <Text className="text-sm leading-6 text-kyar-text dark:text-kyar-dark-text">{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(APP_HREF.settingsSubscription)}
        className="mt-3 self-start active:opacity-80"
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-accent dark:text-kyar-dark-accent">
          {ctaLabel ?? t("upgrade.viewPlans")}
        </Text>
      </Pressable>
    </View>
  );
}
