import { FlatList, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { APP_HREF } from "@/lib/appRoutes";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { DataBoundary } from "@/ui";
import { GlassEmptyState, PhotoBackdrop } from "@/ui/glass";

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const identity = useQuery(api.auth.getCurrentUser);
  const currentUserId = identity?.subject;
  const builds = useQuery(api.builds.listDiscover, { limit: 50 }) ?? [];
  const status = builds ? "ready" : "loading";

  return (
    <>
      {/* Glass Studio 7.4 (12b): the screen draws its own glass headline on the studio wall. */}
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1 }}>
        {/* No image: the calm browsing grid sits on the studio-wall gradient. */}
        <PhotoBackdrop scrim="off" kenBurns={false} />

        <DataBoundary status={status} data={{ builds }}>
          {() => (
            <FlatList
              data={builds}
              keyExtractor={(build) => String(build._id)}
              numColumns={2}
              style={{ flex: 1 }}
              // Pitfall 5: two-up tiles need real widths or they collapse.
              columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
              contentContainerStyle={{
                gap: 12,
                paddingTop: insets.top + 58,
                paddingBottom: insets.bottom + 40,
              }}
              ListHeaderComponent={
                <View>
                  <OfflineBanner style={{ marginHorizontal: 16, marginBottom: 14 }} />
                  <View style={{ paddingHorizontal: 22, paddingBottom: 10 }}>
                    <Text
                      style={{
                        fontFamily: APP_FONT_FAMILIES.displayItalic,
                        fontSize: 34,
                        lineHeight: 38,
                        letterSpacing: ls(-0.02, 34),
                        color: glass.text.fg,
                      }}
                    >
                      {t("discover.title")}
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
                      {t("discover.subtitle")}
                    </Text>
                  </View>
                </View>
              }
              ListEmptyComponent={
                <GlassEmptyState
                  icon="compass-outline"
                  message={t("discover.emptyBody")}
                  style={{ paddingVertical: 48 }}
                />
              }
              renderItem={({ item, index }) => (
                <View style={{ flex: 1, maxWidth: "50%" }}>
                  <PublicBuildCard
                    build={item}
                    projectIndex={index + 1}
                    currentUserId={currentUserId}
                    onPress={() => router.push(APP_HREF.publicBuild(item._id))}
                    onPressOwner={
                      item.ownerUsername
                        ? () => router.push(APP_HREF.profile(item.ownerUsername!))
                        : undefined
                    }
                  />
                </View>
              )}
            />
          )}
        </DataBoundary>

        {/* Screen chrome: back over the wall (stack route with its own glass headline). */}
        <View style={{ position: "absolute", top: insets.top + 10, left: 10 }}>
          <MobileBackButton surface="glass" fallbackHref={APP_HREF.home} />
        </View>
      </View>
    </>
  );
}
