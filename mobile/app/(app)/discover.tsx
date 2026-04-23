import { ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { APP_HREF } from "@/lib/appRoutes";
import { DataBoundary, SectionHeading, SurfaceCard } from "@/ui";

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useQuery(api.auth.getCurrentUser);
  const currentUserId = identity?.subject;
  const builds = useQuery(api.builds.listDiscover, { limit: 50 }) ?? [];
  const status = builds ? "ready" : "loading";

  return (
    <>
      <Stack.Screen options={{ title: t("nav.discover"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ builds }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <SectionHeading eyebrow={t("nav.discover")} title={t("discover.title")} />
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("discover.subtitle")}
            </Text>

            {builds.length === 0 ? (
              <SurfaceCard className="mt-5 px-4 py-5">
                <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("discover.emptyBody")}
                </Text>
              </SurfaceCard>
            ) : (
              <View className="mt-5 gap-4">
                {builds.map((build) => (
                  <PublicBuildCard
                    key={build._id}
                    build={build}
                    currentUserId={currentUserId}
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
