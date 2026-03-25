import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { StorageImage, ScreenHeader } from "../../src/components/shared";
import { useTranslation } from "react-i18next";

export default function PublicUserProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { username: usernameParam } = useLocalSearchParams<{ username?: string | string[] }>();
  const username =
    typeof usernameParam === "string"
      ? usernameParam
      : Array.isArray(usernameParam)
        ? usernameParam[0]
        : "";
  const { userId: currentUserId } = useCurrentUser();

  const profile = useQuery(api.users.getByUsername, username ? { username } : "skip");
  const currentConvex = useQuery(
    api.users.getByExternalId,
    currentUserId ? { externalId: currentUserId } : "skip"
  );
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
  const followMut = useMutation(api.follows.follow);
  const unfollowMut = useMutation(api.follows.unfollow);
  const [followBusy, setFollowBusy] = useState(false);

  const handleFollow = async () => {
    if (!currentUserId || !profile?.userId || followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await unfollowMut({ followerId: currentUserId, followingId: profile.userId });
      } else {
        await followMut({ followerId: currentUserId, followingId: profile.userId });
      }
    } finally {
      setFollowBusy(false);
    }
  };

  if (!username) {
    return (
      <View className="flex-1 bg-white justify-center px-6">
        <Text className="text-sm text-black/50">{t("UserProfile.missingUsername")}</Text>
      </View>
    );
  }

  if (profile === undefined) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (profile === null) {
    const isOwn = currentConvex?.username?.toLowerCase() === username.toLowerCase().trim();
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader
          meta={t("UserProfile.title")}
          title={t("Common.notFound")}
          onBack={() => router.back()}
        />
        <View className="px-6 mt-10">
          {isOwn ? (
            <>
              <Text className="text-sm text-black/60 text-center">
                {t("UserProfile.privateBlurb")}
              </Text>
              <Text className="text-xs text-black/45 mt-3 text-center">
                {t("UserProfile.privateHint")}
              </Text>
              <Pressable
                className="mt-6 border border-black py-3 items-center"
                onPress={() =>
                  router.push("/settings/account" as unknown as Parameters<typeof router.push>[0])
                }
              >
                <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black">
                  {t("UserProfile.accountSettings")}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text className="text-sm text-black/60 text-center">{t("UserProfile.notFound")}</Text>
          )}
        </View>
      </View>
    );
  }

  const displayName = profile.displayName ?? profile.name ?? profile.username ?? "Cosplayer";

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        meta={t("UserProfile.metaDiscover")}
        title={t("UserProfile.title")}
        onBack={() => router.back()}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-6 pt-6 flex-row gap-6 items-start">
          <View className="w-24 h-24 rounded-full overflow-hidden border border-black/10 bg-[#F5F5F5]">
            {profile.imageStorageId ? (
              <StorageImage
                imageStorageId={profile.imageStorageId}
                imageUrl={profile.image}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : profile.image ? (
              <Image
                source={{ uri: profile.image }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text className="text-3xl text-black/30">👤</Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-serif text-3xl italic text-black">{displayName}</Text>
            {profile.username ? (
              <Text className="text-[10px] uppercase tracking-widest text-black/45 mt-1">
                @{profile.username}
              </Text>
            ) : null}
            {currentUserId && profile.userId !== currentUserId ? (
              <Pressable
                className="mt-4 self-start border border-black px-6 py-2 rounded-full"
                onPress={handleFollow}
                disabled={followBusy}
              >
                <Text className="text-[10px] uppercase tracking-widest font-bold text-black">
                  {followBusy ? "…" : isFollowing ? "Unfollow" : "Follow"}
                </Text>
              </Pressable>
            ) : null}
            {profile.bio ? (
              <Text className="text-sm text-black/70 mt-4 leading-relaxed">{profile.bio}</Text>
            ) : null}
          </View>
        </View>

        <Text className="text-[9px] uppercase tracking-[0.2em] font-bold text-black/50 px-6 mt-10 mb-4 border-b border-black/5 pb-2">
          {t("UserProfile.publicBuilds")}
        </Text>
        {builds === undefined ? (
          <Text className="px-6 text-sm text-black/45">{t("UserProfile.loading")}</Text>
        ) : builds.length === 0 ? (
          <Text className="px-6 text-sm text-black/45">{t("UserProfile.noBuilds")}</Text>
        ) : (
          <FlatList
            data={builds}
            keyExtractor={(b) => b._id}
            numColumns={1}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
            renderItem={({ item: b }) => (
              <Pressable
                className="border border-black/10 rounded-2xl overflow-hidden bg-[#FAFAFA]"
                onPress={() =>
                  router.push({
                    pathname: "/build-detail",
                    params: { id: b._id as string },
                  } as Parameters<typeof router.push>[0])
                }
              >
                <View className="aspect-[4/3] bg-[#EEE]">
                  {b.imageStorageId ? (
                    <StorageImage
                      imageStorageId={b.imageStorageId as Id<"_storage">}
                      imageUrl={b.imageUrl}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : b.imageUrl ? (
                    <Image
                      source={{ uri: b.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-black/30 text-xs">{t("UserProfile.noImage")}</Text>
                    </View>
                  )}
                </View>
                <View className="p-4">
                  {b.character ? (
                    <Text className="text-[9px] uppercase tracking-widest text-black/45 mb-1">
                      {b.character}
                    </Text>
                  ) : null}
                  <Text className="font-serif text-xl italic text-black">{b.name}</Text>
                  {typeof b.tasksTotal === "number" && b.tasksTotal > 0 ? (
                    <Text className="text-[10px] text-black/45 mt-2">
                      {t("Home.tasksProgress", {
                        checked: b.tasksChecked ?? 0,
                        total: b.tasksTotal,
                      })}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </ScrollView>
    </View>
  );
}
