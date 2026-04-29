import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import {
  AD_POLICY,
  getSponsoredPlacement,
  shouldShowAdsForTier,
} from "@kyarafit/design-system/domain/adPolicy";
import { useTier } from "@/lib/useTier";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

type MobileSponsoredAdStripProps = {
  userId: string | null | undefined;
};

export function MobileSponsoredAdStrip({ userId }: MobileSponsoredAdStripProps) {
  const { data: tier, isLoading } = useTier(userId);
  if (isLoading || !tier || !shouldShowAdsForTier(tier.tier)) return null;

  const placement = getSponsoredPlacement("mobile_bottom");

  return (
    <View
      accessibilityLabel={`${AD_POLICY.label}: ${placement.title}`}
      className="border-t border-kyar-borderSubtle bg-kyar-bg/95 px-4 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-bg/95"
    >
      <View className="flex-row items-center gap-3">
        <Text
          style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
          className="text-[9px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta"
        >
          Ad
        </Text>
        <View className="min-w-0 flex-1">
          <Text
            className="text-xs font-semibold text-kyar-text dark:text-kyar-dark-text"
            numberOfLines={1}
          >
            {placement.title}
          </Text>
          <Text
            className="text-[10px] text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
            numberOfLines={1}
          >
            {placement.sponsor}
          </Text>
        </View>
        <Link href={APP_HREF.settingsSubscription} asChild>
          <Pressable className="min-h-[32px] justify-center rounded-full border border-kyar-borderSubtle px-3 dark:border-kyar-dark-borderSubtle">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
              {placement.cta}
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
