import { Alert, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { MobilePageHeader } from "@/components/navigation/MobilePageHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { APP_HREF } from "@/lib/appRoutes";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

export default function PublicProfileScreen() {
  const { t } = useTranslation();
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

  return (
    <>
      <Stack.Screen options={{ title: displayName, headerLargeTitle: false }} />
      <OfflineBanner />
      <MobilePageHeader
        eyebrow={profile?.username ? `@${profile.username}` : t("common.profile")}
        title={displayName}
        subtitle={profile?.bio ?? undefined}
        fallbackHref={APP_HREF.home}
        containerClassName="px-5 pt-4"
      />
      <DataBoundary status={status} data={{ profile }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            {!profile ? (
              <SurfaceCard className="px-4 py-5">
                <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("profile.notFound")}
                </Text>
              </SurfaceCard>
            ) : (
              <>
                <View className="flex-row items-start gap-4">
                  <ProfileAvatar
                    imageStorageId={profile.imageStorageId}
                    imageUrl={profile.image}
                    label={displayName}
                    size={92}
                  />
                  <View className="min-w-0 flex-1">
                    {currentUserId && profile.userId !== currentUserId ? (
                      <Button
                        title={
                          isFollowing ? t("profile.unfollowAction") : t("profile.followAction")
                        }
                        variant="secondary"
                        className="mt-4"
                        onPress={() => void handleFollow()}
                      />
                    ) : null}
                  </View>
                </View>

                <View className="mt-6">
                  <SectionHeading eyebrow={t("common.builds")} title={t("profile.buildsTitle")} />
                  <View className="mt-4 gap-4">
                    {builds === undefined ? (
                      <SurfaceCard className="px-4 py-5">
                        <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {t("profile.loadingBuilds")}
                        </Text>
                      </SurfaceCard>
                    ) : builds.length === 0 ? (
                      <SurfaceCard className="px-4 py-5">
                        <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {t("profile.emptyBuilds")}
                        </Text>
                      </SurfaceCard>
                    ) : (
                      builds.map((build, index) => (
                        <PublicBuildCard
                          key={build._id}
                          build={build}
                          projectIndex={index + 1}
                          currentUserId={currentUserId}
                          onPress={() => router.push(APP_HREF.publicBuild(build._id))}
                        />
                      ))
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}
