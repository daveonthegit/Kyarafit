import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { APP_HREF } from "@/lib/appRoutes";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { BuildSocialActions } from "@/components/social/BuildSocialActions";
import { DataBoundary } from "@/ui";
import { GlassPanel, PhotoBackdrop, PhotoPill, scrimGradientProps } from "@/ui/glass";

type FeedBuild = {
  _id: Id<"builds">;
  name: string;
  character?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  ownerUsername?: string | null;
  ownerName?: string | null;
};

function ownerLabelOf(build: FeedBuild): string | null {
  return build.ownerUsername ? `@${build.ownerUsername}` : (build.ownerName ?? null);
}

export default function FeedScreen() {
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const builds =
    useQuery(api.builds.listFeedFromFollowing, userId ? { userId, limit: 50 } : "skip") ?? [];
  const status = identity === undefined ? "loading" : "ready";

  return (
    <>
      {/* Glass Studio 7.4 (12a): the screen draws its own glass headline over the photo. */}
      <Stack.Screen options={{ headerShown: false }} />
      <DataBoundary status={status} data={{ builds }}>
        {() => <FeedBody userId={userId} builds={builds as FeedBuild[]} />}
      </DataBoundary>
    </>
  );
}

function FeedBody({ userId, builds }: { userId: string | undefined; builds: FeedBuild[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const featured = builds[0];
  const rest = builds.slice(1);
  const featuredOwner = featured ? ownerLabelOf(featured) : null;

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop imageStorageId={featured?.imageStorageId} imageUrl={featured?.imageUrl} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 58,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <OfflineBanner style={{ marginHorizontal: 16, marginBottom: 14 }} />

        {/* Headline block — the single latest build from a followed creator leads the page. */}
        <View style={{ paddingHorizontal: 22 }}>
          {featured ? (
            <>
              <Text
                numberOfLines={2}
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
                {t("feed.latestEyebrow", { defaultValue: "Latest from people you follow" })}
                {featured.character ? ` · ${featured.character}` : ""}
              </Text>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontSize: 38,
                  lineHeight: 42,
                  letterSpacing: ls(-0.02, 38),
                  color: glass.text.fg,
                }}
              >
                {featured.name}
              </Text>

              {featuredOwner ? (
                <Pressable
                  onPress={
                    featured.ownerUsername
                      ? () => router.push(APP_HREF.profile(featured.ownerUsername!))
                      : undefined
                  }
                  disabled={!featured.ownerUsername}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={featuredOwner}
                  className="active:opacity-80"
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 12,
                    borderRadius: 999,
                    backgroundColor: glass.chip.neutral.bg,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 9,
                      letterSpacing: ls(0.14, 9),
                      textTransform: "uppercase",
                      color: glass.chip.neutral.fg,
                    }}
                  >
                    {featuredOwner}
                  </Text>
                </Pressable>
              ) : null}

              {/* Social actions: favorite + comment glass-outline pills, then the one
                  content primary — View build (existing publicBuild navigation). */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                <BuildSocialActions
                  buildId={featured._id}
                  buildName={featured.name}
                  currentUserId={userId}
                  size="featured"
                />
                <PhotoPill
                  variant="solid"
                  label={t("feed.viewBuildAction", { defaultValue: "View build" })}
                  onPress={() => router.push(APP_HREF.publicBuild(featured._id))}
                />
              </View>
            </>
          ) : (
            <>
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
                {t("feed.emptyEyebrow", { defaultValue: "The feed" })}
              </Text>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontSize: 34,
                  lineHeight: 38,
                  letterSpacing: ls(-0.02, 34),
                  color: glass.text.fg,
                }}
              >
                {!userId
                  ? t("feed.signInHeadline", { defaultValue: "Sign in to see your feed." })
                  : t("feed.emptyTitle")}
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: APP_FONT_FAMILIES.sansRegular,
                  fontSize: 12,
                  lineHeight: 18,
                  color: glass.text.fg70,
                }}
              >
                {!userId ? t("feed.signInBody") : t("feed.emptyBody")}
              </Text>
              <View style={{ marginTop: 18, flexDirection: "row" }}>
                <PhotoPill
                  variant="solid"
                  label={t("nav.discover")}
                  onPress={() => router.push(APP_HREF.discover)}
                />
              </View>
            </>
          )}
        </View>

        {/* The feed — glass shelf of poster tiles for the rest (backed by the same query). */}
        {rest.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
            <GlassPanel>
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.24, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg,
                    opacity: 0.85,
                    marginBottom: 12,
                  }}
                >
                  {t("feed.shelfEyebrow", {
                    count: builds.length,
                    defaultValue: "The feed · {{count}}",
                  })}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingRight: 6 }}
                >
                  {rest.map((build) => (
                    <FeedPosterTile
                      key={build._id}
                      build={build}
                      onPress={() => router.push(APP_HREF.publicBuild(build._id))}
                    />
                  ))}
                </ScrollView>
              </View>
            </GlassPanel>
          </View>
        ) : null}
      </ScrollView>

      {/* Screen chrome: back over the photo (stack route with its own glass headline). */}
      <View style={{ position: "absolute", top: insets.top + 10, left: 10 }}>
        <MobileBackButton surface="glass" fallbackHref={APP_HREF.home} />
      </View>
    </View>
  );
}

/** Poster tile (~150×190): photo + bottom scrim + @owner · ♡count meta + serif name. */
function FeedPosterTile({ build, onPress }: { build: FeedBuild; onPress: () => void }) {
  const likeCount = useQuery(api.buildLikes.countByBuild, { buildId: build._id });
  const owner = ownerLabelOf(build);
  const meta = [owner, `♡ ${likeCount ?? 0}`].filter(Boolean).join(" · ");
  const hasImage = build.imageStorageId != null || build.imageUrl != null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={build.name}
      className="active:opacity-80"
      style={{
        width: 150,
        height: 190,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: glass.surface.active,
        borderWidth: borderWidth.hairline,
        borderColor: glass.border.divider,
      }}
    >
      {hasImage ? (
        <ConvexStorageImage
          storageId={build.imageStorageId}
          imageUrl={build.imageUrl}
          className="absolute inset-0 h-full w-full"
          accessibilityLabel={build.name}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 26, color: glass.text.fg45 }}>✦</Text>
        </View>
      )}
      <LinearGradient
        {...scrimGradientProps(glass.scrim.pageVertical)}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        pointerEvents="none"
      />
      <View style={{ position: "absolute", left: 10, right: 10, bottom: 8 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: APP_FONT_FAMILIES.sansSemiBold,
            fontSize: 9,
            letterSpacing: ls(0.14, 9),
            textTransform: "uppercase",
            color: glass.text.fg55,
          }}
        >
          {meta}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 14,
            lineHeight: 16,
            color: glass.text.fg,
          }}
        >
          {build.name}
        </Text>
      </View>
    </Pressable>
  );
}
