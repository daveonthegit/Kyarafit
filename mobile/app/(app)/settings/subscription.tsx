import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import Purchases, { type CustomerInfo, type PurchasesPackage } from "react-native-purchases";
import { api } from "convex/_generated/api";
import {
  SUBSCRIPTION_PLANS,
  formatPlanStorage,
  formatUsdPrice,
  type SubscriptionBillingInterval,
  type SubscriptionPlan,
} from "@kyarafit/design-system/domain/subscriptionPlans";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { formatStorageMb } from "@/lib/formatStorageMb";
import { useTier } from "@/lib/useTier";
import {
  addRevenueCatCustomerInfoUpdateListener,
  customerHasPaidEntitlement,
  didRevenueCatPaywallUnlockEntitlement,
  ensureRevenueCatConfigured,
  getRevenueCatCustomerInfo,
  isRevenueCatPurchaseCancelled,
  isRevenueCatSupportedPlatform,
  presentProPaywallIfNeeded,
  presentRevenueCatCustomerCenter,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "@/lib/revenuecat";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { useDesignTheme } from "@/theme/useDesignTheme";
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

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-[10px] uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta">
        {label}
      </Text>
      <Text className="mt-2 text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
        {value}
      </Text>
    </View>
  );
}

function PlanBullet({
  children,
  iconColor,
  muted = false,
}: {
  children: string;
  iconColor: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Text className="mt-0.5 w-5 text-base text-kyar-text dark:text-kyar-dark-text">
        {muted ? "-" : "✓"}
      </Text>
      <Text
        style={{ color: muted ? undefined : iconColor }}
        className={`min-w-0 flex-1 text-sm leading-6 ${
          muted
            ? "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
            : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {children}
      </Text>
    </View>
  );
}

export default function SettingsSubscriptionScreen() {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const { data: tier, isLoading } = useTier(userId);
  const status = identity === undefined ? "loading" : "ready";

  const nativeIap = isRevenueCatSupportedPlatform();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(nativeIap);
  const [workingPackageId, setWorkingPackageId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const hasPaidEntitlement = customerHasPaidEntitlement(customerInfo);

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
  }, [nativeIap, userId]);

  useEffect(() => {
    if (!nativeIap) return;
    let cancelled = false;
    void (async () => {
      try {
        const info = await getRevenueCatCustomerInfo();
        if (!cancelled) setCustomerInfo(info);
      } catch (e) {
        console.warn("[subscription] customer info", e);
      }
    })();
    const removeListener = addRevenueCatCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });
    return () => {
      cancelled = true;
      removeListener();
    };
  }, [nativeIap, userId]);

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
        const result = await purchaseRevenueCatPackage(pkg);
        setCustomerInfo(result.customerInfo);
        setNotice({ tone: "ok", text: t("settings.subscriptionPurchaseSuccess") });
      } catch (e: unknown) {
        if (isRevenueCatPurchaseCancelled(e)) return;
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
      const info = await restoreRevenueCatPurchases();
      setCustomerInfo(info);
      setNotice({ tone: "ok", text: t("settings.subscriptionRestoreSuccess") });
    } catch {
      setNotice({ tone: "err", text: t("settings.subscriptionRestoreError") });
    } finally {
      setWorkingPackageId(null);
    }
  }, [t]);

  const onPresentPaywall = useCallback(async () => {
    setNotice(null);
    // Supporter and Pro are paid-equivalent; don't prompt an already-paid customer for Pro.
    if (hasPaidEntitlement) {
      setNotice({ tone: "ok", text: "Your subscription is already active." });
      return;
    }
    setWorkingPackageId("paywall");
    try {
      const result = await presentProPaywallIfNeeded();
      const info = await getRevenueCatCustomerInfo();
      setCustomerInfo(info);
      setNotice({
        tone: "ok",
        text: didRevenueCatPaywallUnlockEntitlement(result)
          ? "RevenueCat paywall finished. Your Pro access is active or already unlocked."
          : "RevenueCat paywall closed without a purchase.",
      });
    } catch (e) {
      console.warn("[subscription] paywall", e);
      setNotice({ tone: "err", text: t("settings.subscriptionError") });
    } finally {
      setWorkingPackageId(null);
    }
  }, [hasPaidEntitlement, t]);

  const onPresentCustomerCenter = useCallback(async () => {
    setNotice(null);
    setWorkingPackageId("customer-center");
    try {
      await presentRevenueCatCustomerCenter({
        onRestoreCompleted: ({ customerInfo: restoredInfo }) => {
          setCustomerInfo(restoredInfo);
          setNotice({ tone: "ok", text: t("settings.subscriptionRestoreSuccess") });
        },
        onRestoreFailed: () => {
          setNotice({ tone: "err", text: t("settings.subscriptionRestoreError") });
        },
      });
    } catch (e) {
      console.warn("[subscription] customer center", e);
      setNotice({ tone: "err", text: t("settings.subscriptionError") });
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
                          {plan.payWhatYouWant
                            ? `From ${formatUsdPrice(plan.monthlyPriceUsd)} / mo`
                            : `${formatUsdPrice(plan.monthlyPriceUsd)} / mo`}
                        </Text>
                        <Text className="mt-2 text-xs leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {plan.payWhatYouWant
                            ? "Pay what you want, billed monthly"
                            : isPaid
                              ? `${formatUsdPrice(plan.annualPriceUsd)} / year${
                                  plan.annualSavingsLabel ? ` - ${plan.annualSavingsLabel}` : ""
                                }`
                              : "No payment required"}
                        </Text>

                        <Text className="mt-4 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {plan.audience}
                        </Text>

                        <View className="mt-5 flex-row gap-4 border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
                          <PlanMetric
                            label="Storage"
                            value={formatPlanStorage(plan.storageLimitMb)}
                          />
                          <PlanMetric
                            label="Sync"
                            value={plan.id === "free" ? "Local only" : "All devices"}
                          />
                        </View>

                        <View className="mt-5 gap-3">
                          {plan.highlights.map((highlight) => (
                            <PlanBullet key={highlight} iconColor={colors.text}>
                              {highlight}
                            </PlanBullet>
                          ))}
                        </View>

                        <View className="mt-5 border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
                          <MetaLabel>Included</MetaLabel>
                          <View className="mt-3 gap-2">
                            {plan.features.map((feature) => (
                              <PlanBullet key={feature} iconColor={colors.text}>
                                {feature}
                              </PlanBullet>
                            ))}
                          </View>
                        </View>

                        {plan.notIncluded?.length ? (
                          <View className="mt-5 border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
                            <MetaLabel>Upgrade unlocks</MetaLabel>
                            <View className="mt-3 gap-2">
                              {plan.notIncluded.map((feature) => (
                                <PlanBullet key={feature} iconColor={colors.text} muted>
                                  {feature}
                                </PlanBullet>
                              ))}
                            </View>
                          </View>
                        ) : null}

                        {isPaid && nativeIap && offeringsLoading ? (
                          <View className="mt-4 flex-row items-center gap-3">
                            <ActivityIndicator />
                            <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                              {t("settings.subscriptionOfferingsLoading")}
                            </Text>
                          </View>
                        ) : null}
                        {isPaid && nativeIap && !offeringsLoading && plan.payWhatYouWant ? (
                          <View className="mt-4 flex-row flex-wrap gap-2">
                            {(plan.presets ?? []).map((preset) => {
                              const pkg =
                                packages.find((p) => p.product.identifier === preset.productId) ??
                                null;
                              const disabled =
                                active ||
                                pkg == null ||
                                workingPackageId != null ||
                                !identity?.subject;
                              return (
                                <Button
                                  key={preset.id}
                                  title={
                                    pkg == null
                                      ? "Not configured"
                                      : workingPackageId === pkg.identifier
                                        ? "Opening..."
                                        : pkg.product.priceString || preset.label
                                  }
                                  variant="secondary"
                                  className="flex-1"
                                  disabled={disabled}
                                  onPress={() => {
                                    if (pkg) void onPurchase(pkg);
                                  }}
                                />
                              );
                            })}
                          </View>
                        ) : isPaid && nativeIap && !offeringsLoading ? (
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
                <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  Subscription: {hasPaidEntitlement ? "active" : "not active"}
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
                      title="Open Paywall"
                      variant="primary"
                      className="mt-4"
                      loading={workingPackageId === "paywall"}
                      disabled={workingPackageId != null || !identity?.subject}
                      onPress={() => void onPresentPaywall()}
                    />
                    <Button
                      title={t("settings.subscriptionRestore")}
                      variant="secondary"
                      className="mt-4"
                      disabled={workingPackageId != null || !identity?.subject}
                      onPress={() => void onRestore()}
                    />
                    <Button
                      title="Customer Center"
                      variant="secondary"
                      className="mt-3"
                      loading={workingPackageId === "customer-center"}
                      disabled={workingPackageId != null || !identity?.subject}
                      onPress={() => void onPresentCustomerCenter()}
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
