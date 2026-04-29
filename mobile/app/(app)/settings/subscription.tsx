import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from "react-native-purchases";
import { api } from "convex/_generated/api";
import {
  SUBSCRIPTION_PLANS,
  formatPlanBuildLimit,
  formatPlanStorage,
  formatUsdPrice,
  type SubscriptionBillingInterval,
  type SubscriptionPlan,
} from "@kyarafit/design-system/domain/subscriptionPlans";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { formatStorageMb } from "@/lib/formatStorageMb";
import { useTier } from "@/lib/useTier";
import { ensureRevenueCatConfigured, isRevenueCatSupportedPlatform } from "@/lib/revenuecat";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

function packageForPlanInterval(
  packages: PurchasesPackage[],
  plan: SubscriptionPlan,
  interval: SubscriptionBillingInterval
): PurchasesPackage | null {
  const productId = plan.productIds[interval];
  if (!productId) return null;
  return packages.find((pkg) => pkg.product.identifier === productId) ?? null;
}

function checkoutLabel(
  plan: SubscriptionPlan,
  interval: SubscriptionBillingInterval,
  pkg: PurchasesPackage | null
): string {
  const fallback =
    interval === "annual"
      ? formatUsdPrice(plan.annualPriceUsd)
      : formatUsdPrice(plan.monthlyPriceUsd);
  const price = pkg?.product.priceString || fallback;
  return interval === "annual" ? `${price} / year` : `${price} / month`;
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
  const [workingPackageId, setWorkingPackageId] = useState<string | null>(null);
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
      setWorkingPackageId(pkg.identifier);
      try {
        ensureRevenueCatConfigured();
        await Purchases.purchasePackage(pkg);
        setNotice({ tone: "ok", text: t("settings.subscriptionPurchaseSuccess") });
      } catch (e: unknown) {
        const code = (e as { code?: PURCHASES_ERROR_CODE })?.code;
        if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return;
        setNotice({ tone: "err", text: t("settings.subscriptionError") });
      } finally {
        setWorkingPackageId(null);
      }
    },
    [t]
  );

  const onRestore = useCallback(async () => {
    setNotice(null);
    setWorkingPackageId("restore");
    try {
      ensureRevenueCatConfigured();
      await Purchases.restorePurchases();
      setNotice({ tone: "ok", text: t("settings.subscriptionRestoreSuccess") });
    } catch {
      setNotice({ tone: "err", text: t("settings.subscriptionRestoreError") });
    } finally {
      setWorkingPackageId(null);
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
              <SectionHeading
                eyebrow={t("common.settings")}
                title={t("settings.subscriptionPlan")}
              />
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

              <View className="mt-5">
                <MetaLabel>{t("settings.subscriptionPlansLabel")}</MetaLabel>
                <View className="mt-3 gap-3">
                  {SUBSCRIPTION_PLANS.map((plan) => {
                    const active = plan.tier === tierCode;
                    const isPaid = plan.id !== "free";
                    const monthly = packageForPlanInterval(packages, plan, "monthly");
                    const annual = packageForPlanInterval(packages, plan, "annual");
                    return (
                      <SurfaceCard
                        key={plan.id}
                        className={[
                          "px-4 py-4",
                          active ? "border-kyar-text dark:border-kyar-dark-text" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="min-w-0 flex-1">
                            <Text className="font-serif text-2xl text-kyar-text dark:text-kyar-dark-text">
                              {plan.name}
                            </Text>
                            <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                              {plan.tagline}
                            </Text>
                          </View>
                          {active ? (
                            <Text
                              style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
                              className="text-[10px] uppercase tracking-meta text-kyar-text dark:text-kyar-dark-text"
                            >
                              {t("settings.subscriptionCurrent")}
                            </Text>
                          ) : null}
                        </View>
                        <Text className="mt-4 text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                          {formatUsdPrice(plan.monthlyPriceUsd)} / mo
                        </Text>
                        <Text className="mt-2 text-xs leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {formatPlanStorage(plan.storageLimitMb)} storage -{" "}
                          {formatPlanBuildLimit(plan.maxBuilds)} builds
                        </Text>
                        {isPaid && nativeIap && offeringsLoading ? (
                          <View className="mt-4 flex-row items-center gap-3">
                            <ActivityIndicator />
                            <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                              {t("settings.subscriptionOfferingsLoading")}
                            </Text>
                          </View>
                        ) : null}
                        {isPaid && nativeIap && !offeringsLoading ? (
                          <View className="mt-4 flex-row gap-2">
                            {(["monthly", "annual"] as const).map((interval) => {
                              const pkg = interval === "monthly" ? monthly : annual;
                              const disabled =
                                active ||
                                pkg == null ||
                                workingPackageId != null ||
                                !identity?.subject;
                              return (
                                <Button
                                  key={interval}
                                  title={
                                    pkg == null
                                      ? "Not configured"
                                      : workingPackageId === pkg.identifier
                                        ? "Opening..."
                                        : checkoutLabel(plan, interval, pkg)
                                  }
                                  variant={interval === "annual" ? "primary" : "secondary"}
                                  className="flex-1"
                                  disabled={disabled}
                                  onPress={() => {
                                    if (pkg) void onPurchase(pkg);
                                  }}
                                />
                              );
                            })}
                          </View>
                        ) : null}
                      </SurfaceCard>
                    );
                  })}
                </View>
              </View>

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
                    ) : nativeIap && packages.length === 0 ? (
                      <Text className="mt-4 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("settings.subscriptionNoOfferings")}
                      </Text>
                    ) : null}
                    <Button
                      title={t("settings.subscriptionRestore")}
                      variant="secondary"
                      className="mt-4"
                      disabled={workingPackageId != null || !identity?.subject}
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
