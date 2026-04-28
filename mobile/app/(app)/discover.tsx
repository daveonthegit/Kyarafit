import { ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { MobilePageHeader } from "@/components/navigation/MobilePageHeader";
import { APP_HREF } from "@/lib/appRoutes";
import { DataBoundary, SurfaceCard } from "@/ui";

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useQuery(api.auth.getCurrentUser);
  const currentUserId = identity?.subject;
  const builds = useQuery(api.builds.listDiscover, { limit: 50 }) ?? [];
  const status = builds ? "ready" : "loading";

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("discover.title"),
          headerLargeTitle: false,
        }}
      />
      <MobilePageHeader
        eyebrow={t("nav.discover")}
        title={t("discover.title")}
        subtitle={t("discover.subtitle")}
        fallbackHref={APP_HREF.home}
        containerClassName="px-5 pt-4"
      />
      <DataBoundary status={status} data={{ builds }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            {builds.length === 0 ? (
              <SurfaceCard className="mt-5 px-4 py-5">
                <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("discover.emptyBody")}
                </Text>
              </SurfaceCard>
            ) : (
              <View className="mt-5 gap-4">
                {builds.map((build, index) => (
                  <PublicBuildCard
                    key={build._id}
                    build={build}
                    projectIndex={index + 1}
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
