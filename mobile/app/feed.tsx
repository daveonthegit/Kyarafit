import { View, Text, FlatList, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { ScreenHeader, EmptyState } from "../src/components/shared";
import { useTranslation } from "react-i18next";

export default function FeedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const feed = useQuery(api.builds.listFeedFromFollowing, userId ? { userId, limit: 80 } : "skip");

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader meta={t("Feed.meta")} title={t("Feed.title")} onBack={() => router.back()} />
      {!userId ? (
        <View className="px-6 mt-8">
          <EmptyState
            icon="rss_feed"
            message={t("Feed.signIn")}
            secondary={t("Feed.signInSecondary")}
          />
        </View>
      ) : feed === undefined ? (
        <Text className="text-center mt-10 text-black/50">{t("Common.loading")}</Text>
      ) : feed.length === 0 ? (
        <View className="px-6 mt-8">
          <EmptyState message={t("Feed.empty")} secondary={t("Feed.emptySecondary")} />
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(b) => b._id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 16 }}
          renderItem={({ item }) => (
            <View className="flex-1 mb-8">
              <Pressable
                onPress={() => router.push({ pathname: "/build-detail", params: { id: item._id } })}
              >
                <View className="aspect-[2/3] bg-[#F9F9F9] rounded-xl overflow-hidden mb-2">
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-xs text-black/40">{t("UserProfile.noImage")}</Text>
                    </View>
                  )}
                </View>
                <Text className="font-serif text-base italic text-black" numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
              {item.ownerUsername ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/user/[username]",
                      params: { username: item.ownerUsername as string },
                    } as unknown as Parameters<typeof router.push>[0])
                  }
                >
                  <Text className="text-[10px] uppercase tracking-widest text-black/40 mt-1 underline">
                    @{item.ownerUsername}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}
