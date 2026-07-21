import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary, FloatingCreateMenu } from "@/ui";
import { GlassEmptyState, PhotoBackdrop, PhotoPill, scrimGradientProps } from "@/ui/glass";

const SHELF_TILE_SIZE = 150;

export default function GroupsIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const groups = useQuery(api.groups.listForUser, userId ? { userId } : "skip") ?? [];
  const status = identity === undefined ? "loading" : "ready";

  /** Featured = first from the same list that fills the shelf (12c, web parity). */
  const featured: Doc<"groups"> | undefined = groups[0];
  // Presentation-only reads backing the hero meta (member avatars + build count).
  const featuredDetail = useQuery(
    api.groups.getWithMembers,
    featured && userId ? { groupId: featured._id, userId } : "skip"
  );
  const featuredBuilds =
    useQuery(api.builds.listByGroup, featured ? { groupId: featured._id } : "skip") ?? [];
  const featuredMembers = featuredDetail?.members ?? [];

  const createActions = useMemo(() => buildGlobalAddMenuActions("groups", t, router), [router, t]);

  return (
    <>
      {/* Glass Studio 7.4 (12c): the list draws its own headline over the photo. */}
      <Stack.Screen options={{ headerShown: false }} />
      <DataBoundary status={status} data={{ groups }}>
        {() => (
          <View style={{ flex: 1 }}>
            <PhotoBackdrop
              imageStorageId={featured?.imageStorageId}
              imageUrl={featured?.imageUrl}
            />

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingTop: insets.top + 58,
                paddingBottom: insets.bottom + 140,
              }}
            >
              <OfflineBanner />

              {featured ? (
                <View style={{ paddingHorizontal: 22 }}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 9,
                      letterSpacing: ls(0.26, 9),
                      textTransform: "uppercase",
                      color: glass.text.fg,
                      opacity: 0.75,
                      marginBottom: 8,
                    }}
                    numberOfLines={1}
                  >
                    {t("groups.featuredEyebrow", { defaultValue: "Your groups" })} ·{" "}
                    {featured.visibility}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{
                      fontFamily: APP_FONT_FAMILIES.displayItalic,
                      fontStyle: "italic",
                      fontSize: 38,
                      lineHeight: 42,
                      letterSpacing: ls(-0.02, 38),
                      color: glass.text.fg,
                    }}
                  >
                    {featured.name}
                  </Text>

                  {/* Overlapping member-avatar row + members/builds meta. */}
                  <View
                    style={{
                      marginTop: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {featuredMembers.length > 0 ? (
                      <View style={{ flexDirection: "row" }}>
                        {featuredMembers.slice(0, 5).map((member, index) => (
                          <View
                            key={member.userId}
                            style={{ marginLeft: index === 0 ? 0 : -8 }}
                          >
                            <ProfileAvatar
                              imageStorageId={member.imageStorageId}
                              imageUrl={member.image}
                              label={member.name}
                              size={28}
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Text
                      style={{
                        fontFamily: APP_FONT_FAMILIES.sansBold,
                        fontSize: 9,
                        letterSpacing: ls(0.16, 9),
                        textTransform: "uppercase",
                        color: glass.text.fg70,
                      }}
                      numberOfLines={1}
                    >
                      {t("groups.memberCount", { count: featuredMembers.length })} ·{" "}
                      {t("groups.buildCount", {
                        count: featuredBuilds.length,
                        defaultValue: "{{count}} builds",
                      })}
                    </Text>
                  </View>

                  {/* The one content primary on this screen. */}
                  <View style={{ marginTop: 20 }}>
                    <PhotoPill
                      variant="solid"
                      label={t("groups.openGroupAction", { defaultValue: "Open group" })}
                      onPress={() => router.push(APP_HREF.group(featured._id))}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 22 }}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 9,
                      letterSpacing: ls(0.26, 9),
                      textTransform: "uppercase",
                      color: glass.text.fg,
                      opacity: 0.75,
                      marginBottom: 8,
                    }}
                  >
                    {t("groups.title")}
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
                    {t("groups.emptyHeadline", {
                      defaultValue: "Cosplay is better together.",
                    })}
                  </Text>
                  <GlassEmptyState
                    icon="people-outline"
                    message={t("groups.emptyTitle")}
                    secondary={t("groups.emptyBody")}
                    action={
                      <PhotoPill
                        variant="solid"
                        icon="add"
                        label={t("groups.createAction")}
                        onPress={() => router.push(APP_HREF.groupNew)}
                      />
                    }
                    style={{ paddingVertical: 36 }}
                  />
                </View>
              )}

              {/* Your groups — horizontal shelf ending in the dashed create tile. */}
              {featured ? (
                <View style={{ marginTop: 30 }}>
                  <View style={{ paddingHorizontal: 22 }}>
                    <Text
                      style={{
                        fontFamily: APP_FONT_FAMILIES.sansBold,
                        fontSize: 10,
                        letterSpacing: ls(0.24, 10),
                        textTransform: "uppercase",
                        color: glass.text.fg,
                        opacity: 0.85,
                      }}
                    >
                      {t("groups.featuredEyebrow", { defaultValue: "Your groups" })} ·{" "}
                      {groups.length}
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                  >
                    {groups.map((group: Doc<"groups">) => {
                      const isFeatured = featured._id === group._id;
                      return (
                        <Pressable
                          key={group._id}
                          onPress={() => router.push(APP_HREF.group(group._id))}
                          accessibilityRole="button"
                          accessibilityLabel={group.name}
                          className="active:opacity-90"
                          style={{
                            width: SHELF_TILE_SIZE,
                            height: SHELF_TILE_SIZE,
                            borderRadius: 10,
                            overflow: "hidden",
                            borderWidth: isFeatured ? 1.5 : borderWidth.hairline,
                            borderColor: isFeatured
                              ? glass.border.strong
                              : glass.border.divider,
                            backgroundColor: glass.surface.active,
                          }}
                        >
                          {group.imageStorageId || group.imageUrl ? (
                            <ConvexStorageImage
                              storageId={group.imageStorageId}
                              imageUrl={group.imageUrl}
                              className="h-full w-full"
                            />
                          ) : (
                            // Missing photo = studio wall + group glyph, never a gray box.
                            <View style={{ flex: 1 }}>
                              <LinearGradient
                                {...scrimGradientProps(glass.scrim.studioWall)}
                                style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                              >
                                <Ionicons name="people" size={34} color={glass.text.fg45} />
                              </LinearGradient>
                            </View>
                          )}
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: glass.scrimDim,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: APP_FONT_FAMILIES.sansBold,
                                fontSize: 9,
                                letterSpacing: ls(0.16, 9),
                                textTransform: "uppercase",
                                color: glass.text.fg70,
                              }}
                              numberOfLines={1}
                            >
                              {group.visibility}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={{
                                marginTop: 2,
                                fontFamily: APP_FONT_FAMILIES.displayItalic,
                                fontStyle: "italic",
                                fontSize: 15,
                                lineHeight: 18,
                                color: glass.text.fg,
                              }}
                            >
                              {group.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}

                    {/* Dashed = add affordance (QA-6): existing create navigation. */}
                    <Pressable
                      onPress={() => router.push(APP_HREF.groupNew)}
                      accessibilityRole="button"
                      accessibilityLabel={t("groups.createAction")}
                      className="active:opacity-80"
                      style={{
                        width: SHELF_TILE_SIZE,
                        height: SHELF_TILE_SIZE,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: glass.border.strong,
                      }}
                    >
                      <Ionicons name="add" size={22} color={glass.text.fg70} />
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansBold,
                          fontSize: 9,
                          letterSpacing: ls(0.16, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg70,
                        }}
                      >
                        {t("groups.createAction")}
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              ) : null}
            </ScrollView>

            {/* Screen chrome: glass back over the photo (no nav header). */}
            <View style={{ position: "absolute", top: insets.top + 10, left: 10 }}>
              <MobileBackButton surface="glass" fallbackHref={APP_HREF.more} />
            </View>
          </View>
        )}
      </DataBoundary>

      <FloatingCreateMenu actions={createActions} />
    </>
  );
}
