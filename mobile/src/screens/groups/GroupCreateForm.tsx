import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { can, normalizeTier } from "@kyarafit/design-system/domain/entitlements";
import { glass, ls } from "@kyarafit/design-system/rn";
import { api } from "convex/_generated/api";
import { OfflineBanner } from "@/components/OfflineBanner";
import { UpgradeNotice } from "@/components/UpgradeNotice";
import { APP_HREF } from "@/lib/appRoutes";
import { useTier } from "@/lib/useTier";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassPanel, GlassTextField, PhotoPill, scrimGradientProps } from "@/ui/glass";

/**
 * Create-group surface — glass form grammar (ref 13d). Creating a group is a PAID action
 * (REQ-019/070): free users see a non-blocking upgrade affordance and the create action is
 * gated, while joining/participating stays free. Groups are online-only (REQ-071), so an
 * offline banner sits at the top.
 */
export function GroupCreateForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const { data: tierInfo } = useTier(userId);
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [saving, setSaving] = useState(false);
  const status = identity === undefined ? "loading" : "ready";

  const tier = normalizeTier(tierInfo?.tier);
  const canCreateGroup = can(tier, "group_create");

  const handleCreate = async () => {
    if (!userId || !name.trim() || saving || !canCreateGroup) return;
    setSaving(true);
    try {
      const group = await createGroup({
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      if (group?._id) router.replace(APP_HREF.group(group._id));
      else router.replace(APP_HREF.groups);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("groups.createAction"), headerLargeTitle: false }} />
      <OfflineBanner />
      <DataBoundary status={status} data={{ ready: true }}>
        {() => (
          <View style={{ flex: 1 }}>
            {/* No cover photo on this form — the studio-wall gradient stands in
                (missing-photo rule; avoids a needless storage query). */}
            <LinearGradient
              {...scrimGradientProps(glass.scrim.studioWall)}
              style={StyleSheet.absoluteFill}
            />
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: insets.bottom + 48,
                gap: 18,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ paddingHorizontal: 6 }}>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 10,
                    letterSpacing: ls(0.24, 10),
                    textTransform: "uppercase",
                    color: glass.text.fg70,
                    marginBottom: 8,
                  }}
                >
                  {t("nav.groups")}
                </Text>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.displayItalic,
                    fontStyle: "italic",
                    fontSize: 34,
                    lineHeight: 38,
                    letterSpacing: ls(-0.02, 34),
                    color: glass.text.fg,
                  }}
                >
                  {t("groups.createTitle")}
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 12,
                    lineHeight: 18,
                    color: glass.text.fg70,
                  }}
                >
                  {t("groups.createSubtitle")}
                </Text>
              </View>

              {!canCreateGroup ? <UpgradeNotice message={t("groups.createPaidNotice")} /> : null}

              <GlassPanel style={{ padding: 16 }}>
                <View style={{ gap: 14 }}>
                  <GlassTextField
                    label={t("groups.nameLabel")}
                    accessibilityLabel={t("groups.nameLabel")}
                    value={name}
                    onChangeText={setName}
                    placeholder={t("groups.namePlaceholder")}
                  />
                  <GlassTextField
                    label={t("groups.descriptionLabel")}
                    accessibilityLabel={t("groups.descriptionLabel")}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t("groups.descriptionPlaceholder")}
                    multiline
                    style={{ minHeight: 112, textAlignVertical: "top" }}
                  />

                  <View>
                    <Text
                      style={{
                        fontFamily: APP_FONT_FAMILIES.sansBold,
                        fontSize: 10,
                        letterSpacing: ls(0.16, 10),
                        textTransform: "uppercase",
                        color: glass.text.fg70,
                      }}
                    >
                      {t("groups.visibilityLabel")}
                    </Text>
                    {/* Segmented control — actives are exempt from the one-solid rule. */}
                    <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                      {(
                        [
                          ["private", t("groups.visibilityPrivate")],
                          ["public", t("groups.visibilityPublic")],
                        ] as const
                      ).map(([value, label]) => {
                        const active = visibility === value;
                        return (
                          <Pressable
                            key={value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => setVisibility(value)}
                            className="active:opacity-80"
                            style={
                              active
                                ? {
                                    minHeight: 44,
                                    justifyContent: "center",
                                    borderRadius: 999,
                                    paddingHorizontal: 18,
                                    backgroundColor: glass.surface.solid,
                                  }
                                : {
                                    minHeight: 44,
                                    justifyContent: "center",
                                    borderRadius: 999,
                                    paddingHorizontal: 18,
                                    borderWidth: 1,
                                    borderColor: glass.border.strong,
                                    backgroundColor: glass.surface.bar,
                                  }
                            }
                          >
                            <Text
                              style={{
                                fontFamily: APP_FONT_FAMILIES.sansBold,
                                fontSize: 10,
                                letterSpacing: ls(0.16, 10),
                                textTransform: "uppercase",
                                color: active ? glass.text.ink : glass.text.fg,
                              }}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </GlassPanel>

              {/* Footer: outline Cancel + the form's one solid primary (13d). */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingHorizontal: 6,
                }}
              >
                <PhotoPill
                  variant="outline"
                  label={t("common.cancel")}
                  disabled={saving}
                  onPress={() => router.back()}
                />
                <PhotoPill
                  variant="solid"
                  label={
                    !canCreateGroup
                      ? t("groups.createPaidAction")
                      : saving
                        ? t("groups.creating")
                        : t("groups.createAction")
                  }
                  disabled={canCreateGroup && !name.trim()}
                  onPress={() =>
                    canCreateGroup ? void handleCreate() : router.push(APP_HREF.settingsSubscription)
                  }
                />
              </View>
            </ScrollView>
          </View>
        )}
      </DataBoundary>
    </>
  );
}
