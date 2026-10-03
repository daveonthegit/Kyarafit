import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import Purchases, { type CustomerInfo, type PurchasesPackage } from "react-native-purchases";
import { api } from "convex/_generated/api";
import { glass, ls } from "@kyarafit/design-system/rn";
import {
  SUBSCRIPTION_PLANS,
  formatPlanStorage,
  formatUsdPrice,
  type SubscriptionBillingInterval,
  type SubscriptionPlan,
} from "@kyarafit/design-system/domain/subscriptionPlans";
import { normalizeConvexTier } from "@kyarafit/design-system/domain/subscriptionTierPolicy";
import { formatStorageMb } from "@kyarafit/design-system/domain/cloudStoragePolicy";
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
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassPanel, PhotoPill } from "@/ui/glass";
import {
  AccountAction,
  AccountFrame,
  AccountHeading,
  AccountLoading,
  AccountScroll,
  AccountText,
  SectionLabel,
  accountStyles as styles,
} from "@/screens/settings/accountGlass";

function packageForPlanInterval(
  packages: PurchasesPackage[],
  plan: SubscriptionPlan,
  interval: SubscriptionBillingInterval
): PurchasesPackage | null {
  const productId = plan.productIds[interval];
  if (!productId) return null;
  return packages.find((pkg) => pkg.product.identifier === productId) ?? null;
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <SectionLabel>{label}</SectionLabel>
      <AccountText style={{ color: glass.text.fg }}>{value}</AccountText>
    </View>
  );
}
function PlanBullet({ children, muted = false }: { children: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AccountText style={{ width: 18 }}>{muted ? "-" : "✓"}</AccountText>
      <AccountText style={{ flex: 1, color: muted ? glass.text.fg70 : glass.text.fg }}>
        {children}
      </AccountText>
    </View>
  );
}

export default function SettingsSubscriptionScreen() {
  const { t } = useTranslation();
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
      setNotice({
        tone: "ok",
        text: t("settings.subscriptionGlass.alreadyActive", {
          defaultValue: "Your subscription is already active.",
        }),
      });
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
          ? t("settings.subscriptionGlass.paywallUnlocked", {
              defaultValue:
                "RevenueCat paywall finished. Your Pro access is active or already unlocked.",
            })
          : t("settings.subscriptionGlass.paywallClosed", {
              defaultValue: "RevenueCat paywall closed without a purchase.",
            }),
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

  const checkoutLabel = (
    plan: SubscriptionPlan,
    interval: SubscriptionBillingInterval,
    pkg: PurchasesPackage | null
  ) => {
    const fallback =
      interval === "annual"
        ? formatUsdPrice(plan.annualPriceUsd)
        : formatUsdPrice(plan.monthlyPriceUsd);
    const price = pkg?.product.priceString || fallback;
    return interval === "annual"
      ? t("settings.subscriptionGlass.perYear", { defaultValue: "{{price}} / year", price })
      : t("settings.subscriptionGlass.perMonth", { defaultValue: "{{price}} / month", price });
  };
  const openingLabel = t("settings.subscriptionGlass.opening", { defaultValue: "Opening..." });
  const unavailableLabel = t("settings.subscriptionGlass.notConfigured", {
    defaultValue: "Not configured",
  });

  return (
    <AccountFrame>
      <Stack.Screen options={{ title: t("settings.subscriptionPlan"), headerLargeTitle: false }} />
      <DataBoundary
        status={status}
        data={{ tier }}
        loading={<AccountLoading label={t("settings.subscriptionLoading")} />}
      >
        {() => {
          const tierCode = normalizeConvexTier(tier?.tier ?? "FREE");
          const tierTitle = t(`settings.tierName.${tierCode}`);
          return (
            <AccountScroll>
              <AccountHeading
                title={t("settings.subscriptionPlan")}
                subtitle={t("settings.subscriptionSubtitle")}
              />
              <GlassPanel blur={false} style={{ padding: 18, gap: 12 }}>
                <SectionLabel>{t("settings.backupStorage")}</SectionLabel>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.displayItalic,
                    fontSize: 34,
                    lineHeight: 40,
                    color: glass.text.fg,
                  }}
                >
                  {tierTitle}
                </Text>
                <AccountText>
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
                </AccountText>
                {tier?.storageLimitMb && tier.storageLimitMb > 0 ? (
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={t("settings.backupStorage")}
                    accessibilityValue={{
                      min: 0,
                      max: tier.storageLimitMb,
                      now: tier.currentUsageMb,
                    }}
                    style={{
                      height: 8,
                      borderRadius: 4,
                      overflow: "hidden",
                      backgroundColor: glass.surface.field,
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        borderRadius: 4,
                        backgroundColor: glass.text.fg70,
                        width: `${Math.min(100, Math.max(6, (tier.currentUsageMb / tier.storageLimitMb) * 100))}%`,
                      }}
                    />
                  </View>
                ) : null}
              </GlassPanel>
              <SectionLabel>{t("settings.subscriptionPlansLabel")}</SectionLabel>
              {SUBSCRIPTION_PLANS.map((plan) => {
                const active = plan.tier === tierCode;
                const isPaid = plan.id !== "free";
                const monthly = packageForPlanInterval(packages, plan, "monthly");
                const annual = packageForPlanInterval(packages, plan, "annual");
                const planText = (field: "name" | "tagline" | "audience", fallback: string) =>
                  t(`settings.subscriptionGlass.plans.${plan.id}.${field}`, {
                    defaultValue: fallback,
                  });
                const bulletText = (
                  field: "highlights" | "features" | "notIncluded",
                  index: number,
                  fallback: string
                ) =>
                  t(`settings.subscriptionGlass.plans.${plan.id}.${field}.${index}`, {
                    defaultValue: fallback.replace(/\s*\u2728/g, ""),
                  });
                return (
                  <GlassPanel
                    key={plan.id}
                    blur={false}
                    style={{
                      padding: 18,
                      gap: 14,
                      borderColor: active ? glass.border.strong : glass.border.default,
                    }}
                  >
                    <View style={styles.row}>
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: APP_FONT_FAMILIES.displayItalic,
                          fontSize: 28,
                          lineHeight: 32,
                          color: glass.text.fg,
                        }}
                      >
                        {planText("name", plan.name)}
                      </Text>
                      {active ? (
                        <Text
                          style={{
                            borderWidth: 1,
                            borderColor: glass.border.strong,
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            color: glass.text.fg,
                            fontFamily: APP_FONT_FAMILIES.sansBold,
                            fontSize: 10,
                            letterSpacing: ls(0.16, 10),
                            textTransform: "uppercase",
                          }}
                        >
                          {t("settings.subscriptionCurrent")}
                        </Text>
                      ) : null}
                    </View>
                    <AccountText>{planText("tagline", plan.tagline)}</AccountText>
                    <AccountText style={{ color: glass.text.fg }}>
                      {plan.payWhatYouWant
                        ? t("settings.subscriptionGlass.fromMonthly", {
                            defaultValue: "From {{price}} / mo",
                            price: formatUsdPrice(plan.monthlyPriceUsd),
                          })
                        : t("settings.subscriptionGlass.monthly", {
                            defaultValue: "{{price}} / mo",
                            price: formatUsdPrice(plan.monthlyPriceUsd),
                          })}
                    </AccountText>
                    <AccountText>
                      {plan.payWhatYouWant
                        ? t("settings.subscriptionGlass.payWhatYouWant", {
                            defaultValue: "Pay what you want, billed monthly",
                          })
                        : isPaid
                          ? t("settings.subscriptionGlass.annual", {
                              defaultValue: "{{price}} / year{{savings}}",
                              price: formatUsdPrice(plan.annualPriceUsd),
                              savings: plan.annualSavingsLabel
                                ? ` - ${t("settings.subscriptionGlass.annualSavings", { defaultValue: "Save 2 months" })}`
                                : "",
                            })
                          : t("settings.subscriptionGlass.noPayment", {
                              defaultValue: "No payment required",
                            })}
                    </AccountText>
                    <AccountText>{planText("audience", plan.audience)}</AccountText>
                    <View
                      style={{
                        ...styles.row,
                        borderTopWidth: 1,
                        borderTopColor: glass.border.divider,
                        paddingTop: 14,
                      }}
                    >
                      <PlanMetric
                        label={t("settings.subscriptionGlass.storage", { defaultValue: "Storage" })}
                        value={
                          plan.storageLimitMb < 0
                            ? t("settings.subscriptionGlass.unlimited", {
                                defaultValue: "Unlimited",
                              })
                            : formatPlanStorage(plan.storageLimitMb)
                        }
                      />
                      <PlanMetric
                        label={t("settings.subscriptionGlass.sync", { defaultValue: "Sync" })}
                        value={
                          plan.id === "free"
                            ? t("settings.subscriptionGlass.localOnly", {
                                defaultValue: "Local only",
                              })
                            : t("settings.subscriptionGlass.allDevices", {
                                defaultValue: "All devices",
                              })
                        }
                      />
                    </View>
                    <View style={styles.stack}>
                      {plan.highlights.map((highlight, i) => (
                        <PlanBullet key={highlight}>
                          {bulletText("highlights", i, highlight)}
                        </PlanBullet>
                      ))}
                    </View>
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: glass.border.divider,
                        paddingTop: 14,
                        gap: 12,
                      }}
                    >
                      <SectionLabel>
                        {t("settings.subscriptionGlass.included", { defaultValue: "Included" })}
                      </SectionLabel>
                      {plan.features.map((feature, i) => (
                        <PlanBullet key={feature}>{bulletText("features", i, feature)}</PlanBullet>
                      ))}
                    </View>
                    {plan.notIncluded?.length ? (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: glass.border.divider,
                          paddingTop: 14,
                          gap: 12,
                        }}
                      >
                        <SectionLabel>
                          {t("settings.subscriptionGlass.upgradeUnlocks", {
                            defaultValue: "Upgrade unlocks",
                          })}
                        </SectionLabel>
                        {plan.notIncluded.map((feature, i) => (
                          <PlanBullet key={feature} muted>
                            {bulletText("notIncluded", i, feature)}
                          </PlanBullet>
                        ))}
                      </View>
                    ) : null}
                    {isPaid && nativeIap && offeringsLoading ? (
                      <View style={styles.row}>
                        <ActivityIndicator color={glass.text.fg} />
                        <AccountText>{t("settings.subscriptionOfferingsLoading")}</AccountText>
                      </View>
                    ) : null}
                    {isPaid && nativeIap && !offeringsLoading && plan.payWhatYouWant ? (
                      <View style={styles.stack}>
                        {(plan.presets ?? []).map((preset) => {
                          const pkg =
                            packages.find((p) => p.product.identifier === preset.productId) ?? null;
                          const disabled =
                            active || pkg == null || workingPackageId != null || !identity?.subject;
                          return (
                            <PhotoPill
                              key={preset.id}
                              label={
                                pkg == null
                                  ? unavailableLabel
                                  : workingPackageId === pkg.identifier
                                    ? openingLabel
                                    : pkg.product.priceString ||
                                      t("settings.subscriptionGlass.monthly", {
                                        defaultValue: "{{price}} / mo",
                                        price: formatUsdPrice(preset.monthlyPriceUsd),
                                      })
                              }
                              variant="outline"
                              disabled={disabled}
                              onPress={() => {
                                if (pkg) void onPurchase(pkg);
                              }}
                            />
                          );
                        })}
                      </View>
                    ) : isPaid && nativeIap && !offeringsLoading ? (
                      <View style={styles.stack}>
                        {(["monthly", "annual"] as const).map((interval) => {
                          const pkg = interval === "monthly" ? monthly : annual;
                          const disabled =
                            active || pkg == null || workingPackageId != null || !identity?.subject;
                          return (
                            <PhotoPill
                              key={interval}
                              label={
                                pkg == null
                                  ? unavailableLabel
                                  : workingPackageId === pkg.identifier
                                    ? openingLabel
                                    : checkoutLabel(plan, interval, pkg)
                              }
                              variant="outline"
                              disabled={disabled}
                              onPress={() => {
                                if (pkg) void onPurchase(pkg);
                              }}
                            />
                          );
                        })}
                      </View>
                    ) : null}
                  </GlassPanel>
                );
              })}
              <GlassPanel blur={false} style={{ padding: 18, gap: 14 }}>
                <SectionLabel>{t("settings.subscriptionStatus")}</SectionLabel>
                <AccountText>{subscriptionBody}</AccountText>
                <AccountText>
                  {hasPaidEntitlement
                    ? t("settings.subscriptionGlass.active", {
                        defaultValue: "Subscription: active",
                      })
                    : t("settings.subscriptionGlass.inactive", {
                        defaultValue: "Subscription: not active",
                      })}
                </AccountText>
                {notice ? (
                  <AccountText accessibilityLiveRegion="polite" danger={notice.tone === "err"}>
                    {notice.text}
                  </AccountText>
                ) : null}
                {nativeIap ? (
                  <>
                    {offeringsLoading ? (
                      <View style={styles.row}>
                        <ActivityIndicator color={glass.text.fg} />
                        <AccountText>{t("settings.subscriptionOfferingsLoading")}</AccountText>
                      </View>
                    ) : nativeIap && packages.length === 0 ? (
                      <AccountText>{t("settings.subscriptionNoOfferings")}</AccountText>
                    ) : null}
                    <PhotoPill
                      label={
                        workingPackageId === "paywall"
                          ? openingLabel
                          : t("settings.subscriptionGlass.openPaywall", {
                              defaultValue: "Open Paywall",
                            })
                      }
                      disabled={workingPackageId != null || !identity?.subject}
                      accessibilityState={{ busy: workingPackageId === "paywall" }}
                      onPress={() => void onPresentPaywall()}
                    />
                    <PhotoPill
                      label={t("settings.subscriptionRestore")}
                      variant="outline"
                      disabled={workingPackageId != null || !identity?.subject}
                      accessibilityState={{ busy: workingPackageId === "restore" }}
                      onPress={() => void onRestore()}
                    />
                    <PhotoPill
                      label={
                        workingPackageId === "customer-center"
                          ? openingLabel
                          : t("settings.subscriptionGlass.customerCenter", {
                              defaultValue: "Customer Center",
                            })
                      }
                      variant="outline"
                      disabled={workingPackageId != null || !identity?.subject}
                      accessibilityState={{ busy: workingPackageId === "customer-center" }}
                      onPress={() => void onPresentCustomerCenter()}
                    />
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: glass.border.divider,
                        paddingTop: 14,
                        gap: 12,
                      }}
                    >
                      <SectionLabel>{t("settings.subscriptionLegalSection")}</SectionLabel>
                      <AccountText>{t("settings.subscriptionLegalNotice")}</AccountText>
                      <AccountAction onPress={() => void openWebAppPath("/terms", t)}>
                        {t("settings.accountPage.termsOfService")}
                      </AccountAction>
                      <AccountAction onPress={() => void openWebAppPath("/privacy", t)}>
                        {t("settings.accountPage.privacyPolicy")}
                      </AccountAction>
                    </View>
                  </>
                ) : (
                  <PhotoPill
                    label={t("settings.subscriptionUnavailable")}
                    variant="outline"
                    disabled
                  />
                )}
              </GlassPanel>
            </AccountScroll>
          );
        }}
      </DataBoundary>
    </AccountFrame>
  );
}
