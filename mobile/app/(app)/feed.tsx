import { ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { APP_HREF } from "@/lib/appRoutes";
import { Button, DataBoundary, SurfaceCard } from "@/ui";

export default function FeedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const builds =
    useQuery(api.builds.listFeedFromFollowing, userId ? { userId, limit: 50 } : "skip") ?? [];
  const status = identity === undefined ? "loading" : "ready";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("feed.title"),
          headerLargeTitle: false,
        }}
      />
      <DataBoundary status={status} data={{ builds }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("feed.subtitle")}
            </Text>

            {!userId ? (
              <SurfaceCard className="mt-5 px-4 py-5">
                <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("feed.signInBody")}
                </Text>
                <Button
                  title={t("nav.discover")}
                  variant="secondary"
                  className="mt-4"
                  onPress={() => router.push(APP_HREF.discover)}
                />
              </SurfaceCard>
            ) : builds.length === 0 ? (
              <SurfaceCard className="mt-5 px-4 py-5">
                <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("feed.emptyTitle")}
                </Text>
                <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("feed.emptyBody")}
                </Text>
                <Button
                  title={t("nav.discover")}
                  variant="secondary"
                  className="mt-4"
                  onPress={() => router.push(APP_HREF.discover)}
                />
              </SurfaceCard>
            ) : (
              <View className="mt-5 gap-4">
                {builds.map((build, index) => (
                  <PublicBuildCard
                    key={build._id}
                    build={build}
                    projectIndex={index + 1}
                    currentUserId={userId}
                    onPress={() => router.push(APP_HREF.publicBuild(build._id))}
                    onPressOwner={
                      build.ownerUsername
                        ? () => router.push(APP_HREF.profile(build.ownerUsername!))
                        : undefined
                    }
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}
