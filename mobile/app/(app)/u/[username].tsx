import { useMemo } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { PhotoBackdrop, PhotoPill } from "@/ui/glass";

export default function PublicProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rawUsername = useLocalSearchParams<{ username: string | string[] }>().username;
  const username = Array.isArray(rawUsername) ? rawUsername[0] : rawUsername;
  const identity = useQuery(api.auth.getCurrentUser);
  const currentUserId = identity?.subject;
  const profile = useQuery(api.users.getByUsername, username ? { username } : "skip");
  const builds = useQuery(
    api.builds.listPublicByUser,
    profile?.userId ? { userId: profile.userId } : "skip"
  );
  const followerIds = useQuery(
    api.follows.listFollowerIds,
    profile?.userId ? { followingId: profile.userId } : "skip"
  );
  const followingIds = useQuery(
    api.follows.listFollowingIds,
    profile?.userId ? { followerId: profile.userId } : "skip"
  );
  const isFollowing = useQuery(
    api.follows.isFollowing,
    currentUserId && profile?.userId && currentUserId !== profile.userId
      ? { followerId: currentUserId, followingId: profile.userId }
      : "skip"
  );
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);

  const handleFollow = async () => {
    if (!currentUserId || !profile?.userId) return;
    try {
      if (isFollowing) {
        await unfollow({ followerId: currentUserId, followingId: profile.userId });
      } else {
        await follow({ followerId: currentUserId, followingId: profile.userId });
      }
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  };

  const displayName =
    profile?.displayName ?? profile?.name ?? profile?.username ?? t("profile.fallbackName");
  const status = username && profile === undefined ? "loading" : "ready";

  /** 2-col grid columns with real widths (pitfall 5: no zero-width tiles). */
  const buildColumns = useMemo(() => {
    const left: NonNullable<typeof builds> = [];
    const right: NonNullable<typeof builds> = [];
    (builds ?? []).forEach((build, index) => {
      if (index % 2 === 0) left.push(build);
      else right.push(build);
    });
    return [left, right] as const;
  }, [builds]);

  const identityMeta = [
    ...(builds !== undefined
      ? [t("profile.buildsMeta", { defaultValue: "{{count}} builds", count: builds.length })]
      : []),
    ...(followerIds !== undefined
      ? [
          t("profile.followersMeta", {
            defaultValue: "{{count}} followers",
            count: followerIds.length,
          }),
        ]
      : []),
    ...(followingIds !== undefined
      ? [
          t("profile.followingMeta", {
            defaultValue: "{{count}} following",
            count: followingIds.length,
          }),
        ]
      : []),
  ].join(" · ");

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: displayName, headerLargeTitle: false }} />
      {/* Studio wall, or the cosplayer's own imagery when available. */}
      <PhotoBackdrop
        imageStorageId={profile?.imageStorageId}
        imageUrl={profile?.image}
        kenBurns={false}
      />

      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <MobileBackButton surface="glass" fallbackHref={APP_HREF.home} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 10,
            letterSpacing: ls(0.2, 10),
            textTransform: "uppercase",
            color: glass.text.fg70,
          }}
        >
          {profile?.username ? `@${profile.username}` : t("common.profile")}
        </Text>
      </View>

      {/* Online-only social surface: offline strip below the bar. */}
      <OfflineBanner />

      <DataBoundary status={status} data={{ profile }}>
        {() => (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: insets.bottom + 24,
            }}
          >
            {!profile ? (
              <View style={{ paddingTop: 48, paddingHorizontal: 8 }}>
                <Text
                  style={{
                    textAlign: "center",
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 13,
                    lineHeight: 19,
                    color: glass.text.fg70,
                  }}
                >
                  {t("profile.notFound")}
                </Text>
              </View>
            ) : (
              <>
                {/* Profile identity headline over the backdrop */}
                <View style={{ paddingHorizontal: 6, paddingTop: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View
                      style={{
                        borderRadius: 46,
                        borderWidth: borderWidth.hairline,
                        borderColor: glass.border.strong,
                      }}
                    >
                      <ProfileAvatar
                        imageStorageId={profile.imageStorageId}
                        imageUrl={profile.image}
                        label={displayName}
                        size={88}
                      />
                    </View>
                    <View style={{ minWidth: 0, flex: 1 }}>
                      {profile.username ? (
                        <Text
                          style={{
                            fontFamily: APP_FONT_FAMILIES.sansBold,
                            fontSize: 9,
                            letterSpacing: ls(0.26, 9),
                            textTransform: "uppercase",
                            color: glass.text.fg70,
                          }}
                        >
                          {`@${profile.username}`}
                        </Text>
                      ) : null}
                      <Text
                        numberOfLines={2}
                        style={{
                          marginTop: 4,
                          fontFamily: APP_FONT_FAMILIES.displayItalic,
                          fontStyle: "italic",
                          fontSize: 34,
                          lineHeight: 38,
                          color: glass.text.fg,
                        }}
                      >
                        {displayName}
                      </Text>
                    </View>
                  </View>

                  {identityMeta ? (
                    <Text
                      style={{
                        marginTop: 12,
                        fontFamily: APP_FONT_FAMILIES.sansMedium,
                        fontSize: 9,
                        letterSpacing: ls(0.16, 9),
                        textTransform: "uppercase",
                        color: glass.text.fg55,
                      }}
                    >
                      {identityMeta}
                    </Text>
                  ) : null}

                  {profile.bio ? (
                    <Text
                      style={{
                        marginTop: 8,
                        fontFamily: APP_FONT_FAMILIES.sansRegular,
                        fontSize: 13,
                        lineHeight: 19,
                        color: glass.text.fg70,
                      }}
                    >
                      {profile.bio}
                    </Text>
                  ) : null}

                  {currentUserId && profile.userId !== currentUserId ? (
                    <PhotoPill
                      variant={isFollowing ? "outline" : "solid"}
                      label={isFollowing ? t("profile.unfollowAction") : t("profile.followAction")}
                      onPress={() => void handleFollow()}
                      style={{ marginTop: 14 }}
                    />
                  ) : null}
                </View>

                {/* Public builds grid */}
                <View style={{ marginTop: 26, paddingHorizontal: 6 }}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 10,
                      letterSpacing: ls(0.2, 10),
                      textTransform: "uppercase",
                      color: glass.text.fg55,
                    }}
                  >
                    {builds !== undefined
                      ? `${t("profile.buildsTitle")} · ${builds.length}`
                      : t("profile.buildsTitle")}
                  </Text>

                  {builds === undefined ? (
                    <Text
                      style={{
                        marginTop: 12,
                        fontFamily: APP_FONT_FAMILIES.sansRegular,
                        fontSize: 13,
                        lineHeight: 19,
                        color: glass.text.fg55,
                      }}
                    >
                      {t("profile.loadingBuilds")}
                    </Text>
                  ) : builds.length === 0 ? (
                    <Text
                      style={{
                        marginTop: 12,
                        fontFamily: APP_FONT_FAMILIES.sansRegular,
                        fontSize: 13,
                        lineHeight: 19,
                        color: glass.text.fg55,
                      }}
                    >
                      {t("profile.emptyBuilds")}
                    </Text>
                  ) : (
                    <View style={{ marginTop: 12, flexDirection: "row", gap: 12 }}>
                      {buildColumns.map((column, columnIndex) => (
                        <View key={`col-${columnIndex}`} style={{ flex: 1, gap: 16 }}>
                          {column.map((build, index) => (
                            <PublicBuildCard
                              key={build._id}
                              build={build}
                              projectIndex={index * 2 + columnIndex + 1}
                              currentUserId={currentUserId}
                              onPress={() => router.push(APP_HREF.publicBuild(build._id))}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </DataBoundary>
    </View>
  );
}
