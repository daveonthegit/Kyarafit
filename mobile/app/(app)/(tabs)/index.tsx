import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { ChooseFocusSheet } from "@/components/ChooseFocusSheet";
import { BuildPortfolioCard } from "@/components/builds/BuildPortfolioCard";
import { ConventionEventPoster } from "@/components/conventions/ConventionEventPoster";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { APP_HREF } from "@/lib/appRoutes";
import { buildListArgs } from "@/lib/buildsListArgs";
import { DataBoundary, MetaLabel, SurfaceCard } from "@/ui";

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
  userId: string;
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
          userId,
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
  const {
    recentBuild,
    upcoming,
    heroUri,
    otherOutfits,
    plannerPreview,
    allBuilds,
    focusedBuildId,
    followingFeed,
    userId,
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
      router.push(APP_HREF.planner);
    },
    [router]
  );

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerClassName="pb-10"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View className="mt-3 px-5 pt-4">
        <Link href={recentBuild ? APP_HREF.build(recentBuild._id) : APP_HREF.builds} asChild>
          <Pressable className="active:opacity-90">
            <BuildPortfolioCard
              variant="comfortable"
              projectIndex={1}
              item={{
                name: recentBuild?.name ?? t("home.addBuildsToFeature"),
                character: recentBuild?.character ?? null,
                status: recentBuild?.status ?? "planning",
                imageStorageId: recentBuild?.imageStorageId ?? null,
                imageUrl: heroUri,
                tasksChecked: recentBuild?.tasksChecked ?? 0,
                tasksTotal: recentBuild?.tasksTotal ?? 0,
              }}
            />
          </Pressable>
        </Link>

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
            <Link href={recentBuild ? APP_HREF.build(recentBuild._id) : APP_HREF.builds} asChild>
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
              return (
                <Link key={convention._id} href={APP_HREF.convention(convention._id)} asChild>
                  <Pressable className="w-[284px] active:opacity-90">
                    <ConventionEventPoster
                      name={convention.name}
                      startDate={convention.startDate}
                      endDate={convention.endDate}
                      location={convention.location}
                      imageStorageId={convention.imageStorageId}
                      imageUrl={convention.imageUrl}
                      plannedBuilds={outfitCount}
                      packingChecked={0}
                      packingTotal={Math.max(1, outfitCount)}
                      metricBuildsLabel={t("home.currentProjects")}
                      metricPackingLabel={t("planner.taskSection")}
                      metricDaysLabel={t("home.upcomingEvents")}
                    />
                  </Pressable>
                </Link>
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
            <Link href={APP_HREF.builds} asChild>
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
            {otherOutfits.map((build, index) => (
              <Link key={build._id} href={APP_HREF.build(build._id)} asChild>
                <Pressable className="w-[184px] active:opacity-90">
                  <BuildPortfolioCard
                    variant="grid"
                    projectIndex={index + 2}
                    item={{
                      name: build.name,
                      character: build.character,
                      status: build.status ?? "planning",
                      imageStorageId: build.imageStorageId ?? null,
                      imageUrl: build.imageUrl ?? null,
                      tasksChecked: build.tasksChecked,
                      tasksTotal: build.tasksTotal,
                    }}
                  />
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
            {followingFeed.map((build, index) => (
              <View key={build._id} className="w-[292px]">
                <PublicBuildCard
                  build={build}
                  currentUserId={userId}
                  onPress={() => router.push(APP_HREF.publicBuild(build._id))}
                  projectIndex={index + 1}
                />
              </View>
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
          <Link href={APP_HREF.planner} asChild>
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
    </ScrollView>
  );
}
