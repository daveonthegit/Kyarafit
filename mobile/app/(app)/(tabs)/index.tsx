import { useCallback, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { ChooseFocusSheet } from "@/components/ChooseFocusSheet";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { APP_HREF } from "@/lib/appRoutes";
import { buildListArgs } from "@/lib/buildsListArgs";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type FocusedBuildRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
  progress: number;
};

type BuildListRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
};

type PlannerPreviewRow = {
  _id: Id<"workflowItems">;
  title: string;
  status: string;
  dueDate?: string;
  overdue: boolean;
  buildId?: Id<"builds">;
  cosplayNodeId?: Id<"cosplayNodes">;
  buildName: string | null;
};

type FollowingFeedRow = BuildListRow & {
  ownerUsername: string | null;
  ownerName: string | null;
};

type HomeLoaded = {
  recentBuild: FocusedBuildRow | null;
  upcoming: { convention: Doc<"conventions">; outfitCount: number }[];
  eventForBuild: { name: string; startDate: string } | null;
  heroUri: string | null;
  otherOutfits: BuildListRow[];
  plannerPreview: PlannerPreviewRow[];
  allBuilds: BuildListRow[];
  focusedBuildId: Id<"builds"> | null;
  followingFeed: FollowingFeedRow[];
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const recentBuild = useQuery(
    api.builds.getFocusedOrMostRecentForUser,
    userId ? { userId } : "skip"
  );
  const upcoming = useQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId, limit: 6 } : "skip"
  );
  const eventForBuild = useQuery(
    api.conventions.getEventForBuild,
    userId && recentBuild ? { buildId: recentBuild._id, userId } : "skip"
  );
  const heroStorageUrl = useQuery(
    api.files.getUrl,
    recentBuild?.imageStorageId ? { storageId: recentBuild.imageStorageId } : "skip"
  );

  const listArgs = useMemo(
    () =>
      buildListArgs({
        userId: userId ?? null,
        activeTab: "all",
        search: "",
        sortBy: "name",
        order: "asc",
      }),
    [userId]
  );
  const allBuilds = useQuery(api.builds.list, listArgs);
  const plannerRows = useQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const focusedBuildId = useQuery(
    api.users.getFocusedBuildId,
    userId ? { externalId: userId } : "skip"
  );
  const followingFeedRows = useQuery(
    api.builds.listFeedFromFollowing,
    userId ? { userId, limit: 16 } : "skip"
  );

  const otherOutfits = useMemo((): BuildListRow[] => {
    if (!allBuilds) return [];
    const rest = recentBuild
      ? allBuilds.filter((build) => build._id !== recentBuild._id)
      : [...allBuilds];
    return [...rest].sort((a, b) => b._creationTime - a._creationTime).slice(0, 8);
  }, [allBuilds, recentBuild]);

  const plannerPreview = useMemo((): PlannerPreviewRow[] => {
    if (!plannerRows) return [];
    return plannerRows
      .filter((item) => item.status !== "done")
      .slice(0, 5)
      .map((item) => ({
        _id: item._id,
        title: item.title,
        status: item.status,
        dueDate: item.dueDate,
        overdue: item.overdue,
        buildId: item.buildId,
        cosplayNodeId: item.cosplayNodeId,
        buildName: item.buildName,
      }));
  }, [plannerRows]);

  const loading =
    identity === undefined ||
    (userId != null &&
      (recentBuild === undefined ||
        upcoming === undefined ||
        allBuilds === undefined ||
        plannerRows === undefined ||
        focusedBuildId === undefined ||
        followingFeedRows === undefined ||
        (recentBuild != null && eventForBuild === undefined) ||
        (recentBuild?.imageStorageId != null && heroStorageUrl === undefined)));

  const error = identity === null ? new Error(t("home.loadError")) : undefined;

  let status: "loading" | "error" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else status = "ready";

  const heroUri: string | null =
    recentBuild?.imageUrl ??
    (recentBuild?.imageStorageId ? (heroStorageUrl ?? null) : null) ??
    null;

  const data: HomeLoaded | undefined =
    status === "ready" && userId
      ? {
          recentBuild: recentBuild ?? null,
          upcoming: upcoming ?? [],
          eventForBuild: eventForBuild ?? null,
          heroUri,
          otherOutfits,
          plannerPreview,
          allBuilds: allBuilds ?? [],
          focusedBuildId: focusedBuildId ?? null,
          followingFeed: (followingFeedRows ?? []) as FollowingFeedRow[],
        }
      : undefined;

  return (
    <DataBoundary<HomeLoaded> status={status} data={data} error={error}>
      {(loaded) => <HomeDashboardBody loaded={loaded} t={t} />}
    </DataBoundary>
  );
}

type FocusSheetRef = ComponentRef<typeof BottomSheetModal>;

function HomeDashboardBody({
  loaded,
  t,
}: {
  loaded: HomeLoaded;
  t: (key: string, opt?: Record<string, string | number>) => string;
}) {
  const router = useRouter();
  const { scheme } = useDesignTheme();
  const {
    recentBuild,
    upcoming,
    eventForBuild,
    heroUri,
    otherOutfits,
    plannerPreview,
    allBuilds,
    focusedBuildId,
    followingFeed,
  } = loaded;

  const focusSheetRef = useRef<FocusSheetRef>(null);
  const setFocusedBuild = useMutation(api.users.setFocusedBuild);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const openFocusSheet = useCallback(() => {
    focusSheetRef.current?.present();
  }, []);

  const onSelectMostRecent = useCallback(async () => {
    await setFocusedBuild({});
    focusSheetRef.current?.dismiss();
  }, [setFocusedBuild]);

  const onSelectFocusBuild = useCallback(
    async (id: Id<"builds">) => {
      await setFocusedBuild({ buildId: id });
      focusSheetRef.current?.dismiss();
    },
    [setFocusedBuild]
  );

  const taskPct =
    recentBuild && recentBuild.tasksTotal > 0
      ? (100 * recentBuild.tasksChecked) / recentBuild.tasksTotal
      : 0;
  const imageOverlayColors: [string, string, string] =
    scheme === "dark"
      ? ["rgba(12, 11, 20, 0.08)", "rgba(12, 11, 20, 0.18)", "rgba(12, 11, 20, 0.84)"]
      : ["rgba(15, 12, 24, 0.04)", "rgba(15, 12, 24, 0.14)", "rgba(15, 12, 24, 0.72)"];

  const openPlannerItem = useCallback(
    (item: PlannerPreviewRow) => {
      if (item.buildId) {
        router.push(APP_HREF.build(item.buildId));
        return;
      }
      if (item.cosplayNodeId) {
        router.push(APP_HREF.element(item.cosplayNodeId));
        return;
      }
      router.push("/(app)/(tabs)/planner");
    },
    [router]
  );

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerClassName="pb-10"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="px-5 pb-2 pt-4">
        <SectionHeading eyebrow={recentBuild?.character ?? "Kyarafit"} title={t("home.title")} />
      </View>

      <View className="mt-3 px-5">
        <SurfaceCard className="overflow-hidden">
          <View className="relative aspect-[4/4.6] w-full bg-kyar-muted dark:bg-kyar-dark-muted">
            {heroUri ? (
              <FocalCoverImage
                uri={heroUri}
                focalX={recentBuild?.imageFocalX}
                focalY={recentBuild?.imageFocalY}
                className="absolute inset-0"
                accessibilityLabel={recentBuild?.name ?? t("home.title")}
              />
            ) : (
              <View className="absolute inset-0 items-center justify-center">
                <Text className="text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("home.heroFallback")}
                </Text>
              </View>
            )}
            <LinearGradient
              pointerEvents="none"
              colors={imageOverlayColors}
              locations={[0, 0.45, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
            <View className="absolute inset-x-0 bottom-0 gap-2 px-4 pb-5 pt-12">
              <MetaLabel className="text-kyar-bg dark:text-kyar-bg">
                {t("home.currentFocus")}
              </MetaLabel>
              <Text className="font-serif text-4xl italic leading-[40px] text-kyar-bg">
                {recentBuild?.name ?? t("home.addBuildsToFeature")}
              </Text>
              {recentBuild ? (
                <Text className="text-sm leading-6 text-kyar-bg/90">
                  {t("home.itemsComplete", {
                    checked: recentBuild.tasksChecked,
                    total: recentBuild.tasksTotal,
                  })}
                  {recentBuild.character ? ` · ${recentBuild.character}` : ""}
                </Text>
              ) : null}
              {recentBuild && eventForBuild ? (
                <Text className="text-xs uppercase tracking-wide text-kyar-bg/80">
                  {t("home.plannedFor", { name: eventForBuild.name })}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="gap-3 px-4 pb-4 pt-4">
            {recentBuild && recentBuild.tasksTotal > 0 ? (
              <View>
                <View className="h-1.5 overflow-hidden rounded-full bg-kyar-borderSubtle dark:bg-kyar-dark-borderSubtle">
                  <View
                    className="h-full rounded-full bg-kyar-text dark:bg-kyar-dark-text"
                    style={{ width: `${taskPct}%` }}
                  />
                </View>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <HomeInsightCard
                label={t("planner.taskSection")}
                value={
                  recentBuild
                    ? t("home.itemsComplete", {
                        checked: recentBuild.tasksChecked,
                        total: recentBuild.tasksTotal,
                      })
                    : t("home.browseOutfits")
                }
              />
              <HomeInsightCard
                label={t("home.upcomingEvents")}
                value={
                  eventForBuild
                    ? t("home.plannedFor", { name: eventForBuild.name })
                    : upcoming[0]
                      ? t("home.daysUntil", {
                          count: daysUntil(upcoming[0].convention.startDate),
                        })
                      : t("home.noUpcomingEvents")
                }
              />
            </View>
          </View>
        </SurfaceCard>

        <ChooseFocusSheet
          sheetRef={focusSheetRef}
          builds={allBuilds}
          focusedBuildId={focusedBuildId}
          onSelectMostRecent={onSelectMostRecent}
          onSelectBuild={onSelectFocusBuild}
        />

        <View className="mt-3 gap-3">
          <MetaLabel>
            {recentBuild ? t("home.focusMetaHasBuild") : t("home.focusMetaNoBuild")}
          </MetaLabel>
          <View className="flex-row gap-3">
            <Link
              href={recentBuild ? APP_HREF.build(recentBuild._id) : "/(app)/(tabs)/builds"}
              asChild
            >
              <Pressable className="min-h-[52px] flex-1 items-center justify-center rounded-full bg-kyar-text px-5 active:opacity-90 dark:bg-kyar-dark-text">
                <Text className="text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                  {recentBuild ? t("home.openOutfitHint") : t("home.browseOutfits")}
                </Text>
              </Pressable>
            </Link>

            {allBuilds.length > 0 ? (
              <Pressable
                onPress={openFocusSheet}
                className="min-h-[52px] flex-1 items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-surface px-5 active:opacity-90 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
              >
                <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("home.selectFocus")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View className="mt-8 px-5">
        <View className="flex-row items-end justify-between gap-4">
          <View className="min-w-0 flex-1">
            <MetaLabel>{t("home.upcomingEvents")}</MetaLabel>
            <Text className="mt-1 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
              {t("home.upcomingEvents")}
            </Text>
          </View>
        </View>
        {upcoming.length === 0 ? (
          <Text className="mt-3 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("home.noUpcomingEvents")}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-5"
            contentContainerClassName="gap-3 px-5"
          >
            {upcoming.map(({ convention, outfitCount }) => {
              const days = daysUntil(convention.startDate);
              return (
                <SurfaceCard key={convention._id} className="w-[248px] overflow-hidden">
                  <View className="h-[120px] bg-kyar-muted dark:bg-kyar-dark-muted">
                    {convention.imageStorageId || convention.imageUrl ? (
                      <ConvexStorageImage
                        storageId={convention.imageStorageId}
                        imageUrl={convention.imageUrl}
                        className="h-full w-full"
                        accessibilityLabel={convention.name}
                      />
                    ) : (
                      <View className="h-full items-center justify-center">
                        <Text className="text-3xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                          ⌁
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="px-4 py-4">
                    <MetaLabel>
                      {convention.startDate === convention.endDate
                        ? convention.startDate
                        : `${convention.startDate} – ${convention.endDate}`}
                    </MetaLabel>
                    <Text className="mt-2 font-serif text-xl italic text-kyar-text dark:text-kyar-dark-text">
                      {convention.name}
                    </Text>
                    <Text className="mt-2 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {days >= 0
                        ? t("home.daysUntil", { count: days })
                        : (convention.location ?? "")}
                    </Text>
                    <Text className="mt-1 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                      {outfitCount}{" "}
                      {outfitCount === 1 ? t("home.outfitSingular") : t("home.outfitPlural")}
                    </Text>
                  </View>
                </SurfaceCard>
              );
            })}
          </ScrollView>
        )}
      </View>

      {otherOutfits.length > 0 ? (
        <View className="mt-8 px-5">
          <View className="flex-row items-end justify-between gap-4">
            <View className="min-w-0 flex-1">
              <MetaLabel>{t("home.currentProjects")}</MetaLabel>
              <Text className="mt-1 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
                {t("home.currentProjects")}
              </Text>
            </View>
            <Link href="/(app)/(tabs)/builds" asChild>
              <Pressable>
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-kyar-text underline dark:text-kyar-dark-text">
                  {t("home.viewAllBuilds")}
                </Text>
              </Pressable>
            </Link>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-5"
            contentContainerClassName="gap-3 px-5"
          >
            {otherOutfits.map((build) => (
              <Link key={build._id} href={APP_HREF.build(build._id)} asChild>
                <Pressable className="w-[184px] active:opacity-90">
                  <BuildRailCard build={build} />
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View className="mt-8 px-5">
        <View className="flex-row items-end justify-between gap-4">
          <View className="min-w-0 flex-1">
            <MetaLabel>{t("home.nextSteps")}</MetaLabel>
            <Text className="mt-1 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
              {t("home.nextSteps")}
            </Text>
          </View>
          <Link href="/(app)/(tabs)/planner" asChild>
            <Pressable>
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-kyar-text underline dark:text-kyar-dark-text">
                {t("home.openPlanner")}
              </Text>
            </Pressable>
          </Link>
        </View>

        <SurfaceCard className="mt-3 overflow-hidden px-4 py-3">
          {plannerPreview.length === 0 ? (
            <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("home.noOpenTasks")}
            </Text>
          ) : (
            <View className="gap-3">
              {plannerPreview.map((item, index) => (
                <Pressable
                  key={item._id}
                  onPress={() => openPlannerItem(item)}
                  className={`${index < plannerPreview.length - 1 ? "border-b border-kyar-borderSubtle pb-3 dark:border-kyar-dark-borderSubtle" : ""}`}
                >
                  <View className="flex-row items-start gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-medium leading-6 text-kyar-text dark:text-kyar-dark-text">
                        {item.title}
                      </Text>
                      {item.buildName ? (
                        <Text className="mt-1 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                          {item.buildName}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      className={`rounded-full px-3 py-2 ${
                        item.overdue
                          ? "bg-kyar-danger/10 dark:bg-kyar-dark-danger/15"
                          : "bg-kyar-panel dark:bg-kyar-dark-panel"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          item.overdue
                            ? "text-kyar-danger dark:text-kyar-dark-danger"
                            : "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                        }`}
                      >
                        {item.overdue
                          ? t("home.overdue")
                          : item.dueDate
                            ? t("home.dueDate", { date: item.dueDate })
                            : t("home.noDueDate")}
                      </Text>
                    </View>
                  </View>
                  <Text className="mt-2 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {item.status.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </SurfaceCard>
      </View>

      {followingFeed.length > 0 ? (
        <View className="mt-8 px-5">
          <MetaLabel>{t("home.followingFeed")}</MetaLabel>
          <Text className="mt-1 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
            {t("home.followingFeed")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-5"
            contentContainerClassName="gap-3 px-5"
          >
            {followingFeed.map((build) => (
              <Link key={build._id} href={APP_HREF.build(build._id)} asChild>
                <Pressable className="w-[184px] active:opacity-90">
                  <BuildRailCard
                    build={build}
                    footer={
                      <Text
                        className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta"
                        numberOfLines={1}
                      >
                        {build.ownerUsername
                          ? `@${build.ownerUsername}`
                          : (build.ownerName ?? t("home.followingUnknownCreator"))}
                      </Text>
                    }
                  />
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}

function HomeInsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel">
      <MetaLabel>{label}</MetaLabel>
      <Text className="mt-2 text-sm leading-6 text-kyar-text dark:text-kyar-dark-text">
        {value}
      </Text>
    </View>
  );
}

function BuildRailCard({ build, footer }: { build: BuildListRow; footer?: ReactNode }) {
  const { scheme } = useDesignTheme();
  const pct = build.tasksTotal > 0 ? Math.round((100 * build.tasksChecked) / build.tasksTotal) : 0;
  const imageOverlayColors: [string, string, string] =
    scheme === "dark"
      ? ["rgba(12, 11, 20, 0.08)", "rgba(12, 11, 20, 0.18)", "rgba(12, 11, 20, 0.84)"]
      : ["rgba(15, 12, 24, 0.04)", "rgba(15, 12, 24, 0.14)", "rgba(15, 12, 24, 0.72)"];

  return (
    <SurfaceCard className="overflow-hidden">
      <View className="relative h-[188px] bg-kyar-muted dark:bg-kyar-dark-muted">
        {build.imageStorageId || build.imageUrl ? (
          <ConvexStorageImage
            storageId={build.imageStorageId}
            imageUrl={build.imageUrl}
            className="h-full w-full"
            accessibilityLabel={build.name}
          />
        ) : (
          <View className="h-full items-center justify-center">
            <Text className="text-4xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
              ✦
            </Text>
          </View>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={imageOverlayColors}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View className="absolute inset-x-0 bottom-0 gap-1 px-4 pb-3 pt-10">
          <Text
            className="font-serif text-2xl italic leading-[28px] text-kyar-bg"
            numberOfLines={2}
          >
            {build.name}
          </Text>
          {build.character ? (
            <Text className="text-xs uppercase tracking-wide text-kyar-bg/85" numberOfLines={1}>
              {build.character}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="px-4 py-3">
        <Text className="text-xs text-kyar-meta dark:text-kyar-dark-meta">
          {build.tasksChecked} / {build.tasksTotal} tasks · {pct}%
        </Text>
        {footer ? <View className="mt-2">{footer}</View> : null}
      </View>
    </SurfaceCard>
  );
}
