import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from "react-native-purchases";
import { api } from "convex/_generated/api";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { formatStorageMb } from "@/lib/formatStorageMb";
import { useTier } from "@/lib/useTier";
import { ensureRevenueCatConfigured, isRevenueCatSupportedPlatform } from "@/lib/revenuecat";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

function formatPackageLabel(pkg: PurchasesPackage): string {
  const product = pkg.product;
  const title = product.title ?? pkg.identifier;
  const price = product.priceString;
  return price ? `${title} — ${price}` : title;
}

export default function SettingsSubscriptionScreen() {
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const { data: tier, isLoading } = useTier(userId);
  const status = identity === undefined ? "loading" : "ready";

  const nativeIap = isRevenueCatSupportedPlatform();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsLoading, setOfferingsLoading] = useState(nativeIap);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!nativeIap) {
      setOfferingsLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        ensureRevenueCatConfigured();
        const offerings = await Purchases.getOfferings();
        const list = offerings.current?.availablePackages ?? [];
        if (!cancelled) setPackages(list);
      } catch (e) {
        console.warn("[subscription] offerings", e);
        if (!cancelled) setPackages([]);
      } finally {
        if (!cancelled) setOfferingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nativeIap]);

  const subscriptionBody = useMemo(() => {
    if (!nativeIap || Platform.OS === "web") {
      return t("settings.subscriptionWebHint");
    }
    return t("settings.subscriptionBodyNative");
  }, [nativeIap, t]);

  const onPurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setNotice(null);
      setWorking(true);
      try {
        ensureRevenueCatConfigured();
        await Purchases.purchasePackage(pkg);
        setNotice({ tone: "ok", text: t("settings.subscriptionPurchaseSuccess") });
      } catch (e: unknown) {
        const code = (e as { code?: PURCHASES_ERROR_CODE })?.code;
        if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return;
        setNotice({ tone: "err", text: t("settings.subscriptionError") });
      } finally {
        setWorking(false);
      }
    },
    [t]
  );

  const onRestore = useCallback(async () => {
    setNotice(null);
    setWorking(true);
    try {
      ensureRevenueCatConfigured();
      await Purchases.restorePurchases();
      setNotice({ tone: "ok", text: t("settings.subscriptionRestoreSuccess") });
    } catch {
      setNotice({ tone: "err", text: t("settings.subscriptionRestoreError") });
    } finally {
      setWorking(false);
    }
  }, [t]);

  return (
    <>
      <Stack.Screen options={{ title: t("settings.subscriptionPlan"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ tier }}>
        {() => {
          const tierCode = normalizeConvexTier(tier?.tier ?? "FREE");
          const tierTitle = t(`settings.tierName.${tierCode}`);
          return (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <SectionHeading eyebrow={t("common.settings")} title={t("settings.subscriptionPlan")} />
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("settings.subscriptionSubtitle")}
            </Text>

            <SurfaceCard className="mt-5 px-4 py-4">
              <MetaLabel>{t("settings.backupStorage")}</MetaLabel>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                className="mt-3 text-[34px] italic text-kyar-text dark:text-kyar-dark-text"
              >
                {tierTitle}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {isLoading
                  ? t("settings.subscriptionLoading")
                  : tier
                    ? tier.storageLimitMb >= 0
                      ? t("settings.storageOf", {
                          used: formatStorageMb(tier.currentUsageMb),
                          limit: formatStorageMb(tier.storageLimitMb),
                        })
                      : t("settings.storageUsedUnlimited", {
                          used: formatStorageMb(tier.currentUsageMb),
                        })
                    : t("settings.signInStorageHint")}
              </Text>

              {tier?.storageLimitMb && tier.storageLimitMb > 0 ? (
                <View className="mt-4 h-2 overflow-hidden rounded-full bg-kyar-borderSubtle dark:bg-kyar-dark-borderSubtle">
                  <View
                    className="h-full rounded-full bg-kyar-text dark:bg-kyar-dark-text"
                    style={{
                      width: `${Math.min(100, Math.max(6, (tier.currentUsageMb / tier.storageLimitMb) * 100))}%`,
                    }}
                  />
                </View>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="mt-4 px-4 py-4">
              <MetaLabel>{t("settings.subscriptionStatus")}</MetaLabel>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {subscriptionBody}
              </Text>

              {notice ? (
                <Text
                  className={`mt-3 text-sm leading-6 ${
                    notice.tone === "ok"
                      ? "text-kyar-text dark:text-kyar-dark-text"
                      : "text-kyar-danger dark:text-kyar-dark-danger"
                  }`}
                >
                  {notice.text}
                </Text>
              ) : null}

              {nativeIap ? (
                <>
                  {offeringsLoading ? (
                    <View className="mt-4 flex-row items-center gap-3">
                      <ActivityIndicator />
                      <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("settings.subscriptionOfferingsLoading")}
                      </Text>
                    </View>
                  ) : packages.length === 0 ? (
                    <Text className="mt-4 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("settings.subscriptionNoOfferings")}
                    </Text>
                  ) : (
                    <View className="mt-4 gap-3">
                      {packages.map((pkg) => (
                        <Button
                          key={pkg.identifier}
                          title={formatPackageLabel(pkg)}
                          variant="secondary"
                          disabled={working || !identity?.subject}
                          onPress={() => void onPurchase(pkg)}
                        />
                      ))}
                    </View>
                  )}
                  <Button
                    title={t("settings.subscriptionRestore")}
                    variant="secondary"
                    className="mt-4"
                    disabled={working || !identity?.subject}
                    onPress={() => void onRestore()}
                  />
                  <View className="mt-6 border-t border-kyar-borderSubtle pt-5 dark:border-kyar-dark-borderSubtle">
                    <MetaLabel>{t("settings.subscriptionLegalSection")}</MetaLabel>
                    <Text className="mt-2 text-xs leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("settings.subscriptionLegalNotice")}
                    </Text>
                    <View className="mt-4 flex-row flex-wrap gap-4">
                      <Pressable
                        onPress={() => void openWebAppPath("/terms", t)}
                        className="active:opacity-80"
                        accessibilityRole="link"
                        accessibilityLabel={t("settings.accountPage.termsOfService")}
                      >
                        <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                          {t("settings.accountPage.termsOfService")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void openWebAppPath("/privacy", t)}
                        className="active:opacity-80"
                        accessibilityRole="link"
                        accessibilityLabel={t("settings.accountPage.privacyPolicy")}
                      >
                        <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                          {t("settings.accountPage.privacyPolicy")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <Button
                  title={t("settings.subscriptionUnavailable")}
                  variant="secondary"
                  className="mt-4"
                  disabled
                />
              )}
            </SurfaceCard>
          </ScrollView>
          );
        }}
      </DataBoundary>
    </>
  );
}
