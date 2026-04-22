import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { ComponentRef } from "react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { ChooseFocusSheet } from "@/components/ChooseFocusSheet";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { APP_HREF } from "@/lib/appRoutes";
import { buildListArgs } from "@/lib/buildsListArgs";
import { DataBoundary } from "@/ui";

function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Shape returned by `builds.getFocusedOrMostRecentForUser`. */
type FocusedBuildRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
  progress: number;
};

/** Row shape from `api.builds.list` (server strips blended `progress`). */
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
  buildName: string | null;
};

/** Rows from `api.builds.listFeedFromFollowing`. */
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
      ? allBuilds.filter((b) => b._id !== recentBuild._id)
      : [...allBuilds];
    return [...rest]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 8);
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

  const heroCard = (
    <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
      <View className="relative aspect-[4/5] w-full bg-neutral-200">
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
            <Text className="text-neutral-400">{t("home.heroFallback")}</Text>
          </View>
        )}
        <View className="absolute inset-x-0 bottom-0 bg-black/50 px-4 py-3">
          <Text className="text-[10px] font-semibold uppercase tracking-widest text-white">
            {t("home.currentFocus")}
          </Text>
          <Text className="mt-1 text-xl font-semibold text-white">
            {recentBuild?.name ?? t("home.addBuildsToFeature")}
          </Text>
          {recentBuild ? (
            <Text className="mt-1 text-sm text-white/90">
              {t("home.itemsComplete", {
                checked: recentBuild.tasksChecked,
                total: recentBuild.tasksTotal,
              })}
              {recentBuild.character ? ` · ${recentBuild.character}` : ""}
            </Text>
          ) : null}
          {recentBuild && eventForBuild ? (
            <Text className="mt-1 text-xs uppercase tracking-wide text-white/80">
              {t("home.plannedFor", { name: eventForBuild.name })}
            </Text>
          ) : null}
        </View>
      </View>
      {recentBuild && recentBuild.tasksTotal > 0 ? (
        <View className="px-4 py-2">
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <View
              className="h-full rounded-full bg-neutral-900"
              style={{ width: `${taskPct}%` }}
              accessibilityRole="progressbar"
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="pb-8"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text className="px-4 pt-2 text-2xl font-semibold text-neutral-900">{t("home.title")}</Text>

      <View className="mt-4 px-4">
        {recentBuild ? (
          <Link href={APP_HREF.build(recentBuild._id)} asChild>
            <Pressable accessibilityRole="button" accessibilityHint={t("home.openOutfitHint")}>
              {heroCard}
            </Pressable>
          </Link>
        ) : (
          heroCard
        )}

        {allBuilds.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-[10px] uppercase tracking-widest text-neutral-500">
              {recentBuild ? t("home.focusMetaHasBuild") : t("home.focusMetaNoBuild")}
            </Text>
            <Pressable onPress={openFocusSheet} accessibilityRole="button">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-900 underline">
                {t("home.selectFocus")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <ChooseFocusSheet
          sheetRef={focusSheetRef}
          builds={allBuilds}
          focusedBuildId={focusedBuildId}
          onSelectMostRecent={onSelectMostRecent}
          onSelectBuild={onSelectFocusBuild}
        />

        <Link href="/(app)/(tabs)/builds" asChild>
          <Pressable className="mt-4 items-center rounded-xl bg-neutral-900 py-3 active:opacity-90">
            <Text className="font-semibold text-white">{t("home.browseOutfits")}</Text>
          </Pressable>
        </Link>
      </View>

      <View className="mt-8 px-4">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t("home.followingFeed")}
        </Text>
        {followingFeed.length === 0 ? (
          <Text className="mt-2 text-neutral-600">{t("home.followingEmpty")}</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-4"
            contentContainerClassName="gap-3 px-4"
          >
            {followingFeed.map((b) => (
              <Link key={b._id} href={APP_HREF.build(b._id)} asChild>
                <Pressable className="w-[168] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 active:opacity-90">
                  <View className="h-[92] w-full items-center justify-center bg-neutral-200 px-2">
                    <Text
                      className="text-center text-[15px] font-semibold leading-tight text-neutral-900"
                      numberOfLines={2}
                    >
                      {b.name}
                    </Text>
                  </View>
                  <View className="px-3 py-2">
                    <Text className="text-[10px] uppercase tracking-wide text-neutral-500" numberOfLines={1}>
                      {b.ownerUsername
                        ? `@${b.ownerUsername}`
                        : b.ownerName ?? t("home.followingUnknownCreator")}
                    </Text>
                    <Text className="mt-1 text-[10px] text-neutral-500">
                      {t("home.itemsComplete", {
                        checked: b.tasksChecked,
                        total: b.tasksTotal,
                      })}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        )}
      </View>

      {otherOutfits.length > 0 ? (
        <View className="mt-8">
          <View className="flex-row items-baseline justify-between px-4">
            <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {t("home.currentProjects")}
            </Text>
            <Link href="/(app)/(tabs)/builds" asChild>
              <Pressable>
                <Text className="text-xs font-semibold text-neutral-900 underline">
                  {t("home.viewAllBuilds")}
                </Text>
              </Pressable>
            </Link>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerClassName="gap-3 px-4"
          >
            {otherOutfits.map((b) => (
              <Link key={b._id} href={APP_HREF.build(b._id)} asChild>
                <Pressable className="w-[148] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 active:opacity-90">
                  <View className="h-[100] w-full items-center justify-center bg-neutral-200">
                    <Text className="px-2 text-center text-base font-semibold leading-tight text-neutral-900">
                      {b.name}
                    </Text>
                  </View>
                  <View className="px-3 py-2">
                    <Text className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {t("home.itemsComplete", {
                        checked: b.tasksChecked,
                        total: b.tasksTotal,
                      })}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View className="mt-8 px-4">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {t("home.nextSteps")}
          </Text>
          <Link href="/(app)/(tabs)/planner" asChild>
            <Pressable>
              <Text className="text-xs font-semibold text-neutral-900 underline">
                {t("home.openPlanner")}
              </Text>
            </Pressable>
          </Link>
        </View>
        {plannerPreview.length === 0 ? (
          <Text className="mt-2 text-neutral-600">{t("home.noOpenTasks")}</Text>
        ) : (
          <View className="mt-2 gap-2">
            {plannerPreview.map((item) => (
              <View
                key={item._id}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
              >
                <Text className="text-sm font-medium text-neutral-900" numberOfLines={2}>
                  {item.title}
                </Text>
                {item.buildName ? (
                  <Text className="mt-0.5 text-xs text-neutral-500">{item.buildName}</Text>
                ) : null}
                <Text
                  className={`mt-1 text-xs ${item.overdue ? "font-semibold text-red-700" : "text-neutral-500"}`}
                >
                  {item.overdue
                    ? t("home.overdue")
                    : item.dueDate
                      ? t("home.dueDate", { date: item.dueDate })
                      : t("home.noDueDate")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text className="mt-8 px-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t("home.upcomingEvents")}
      </Text>
      {upcoming.length === 0 ? (
        <Text className="mt-2 px-4 text-neutral-600">{t("home.noUpcomingEvents")}</Text>
      ) : (
        <View className="mt-2 px-4">
          {upcoming.map(({ convention, outfitCount }) => {
            const d = daysUntil(convention.startDate);
            return (
              <View
                key={convention._id}
                className="mb-2 rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <Text className="text-base font-semibold text-neutral-900">{convention.name}</Text>
                <Text className="mt-1 text-sm text-neutral-600">
                  {convention.startDate}
                  {d >= 0 ? ` · ${t("home.daysUntil", { count: d })}` : ""}
                </Text>
                <Text className="mt-1 text-xs text-neutral-500">
                  {outfitCount}{" "}
                  {outfitCount === 1 ? t("home.outfitSingular") : t("home.outfitPlural")}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
