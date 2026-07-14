import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glass, ls } from "@kyarafit/design-system/rn";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { ChooseFocusSheet } from "@/components/ChooseFocusSheet";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_HREF } from "@/lib/appRoutes";
import { buildListArgs } from "@/lib/buildsListArgs";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassPanel, PhotoBackdrop, PhotoPill, scrimGradientProps } from "@/ui/glass";

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
  dueSoonCount: number;
  allBuilds: BuildListRow[];
  focusedBuildId: Id<"builds"> | null;
  followingFeed: FollowingFeedRow[];
};

function isoDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whole days from today to `startDate` (ISO date), matching web home. */
function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

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

  /** Incomplete dated tasks due within the next 7 days — mirrors web home's headline count. */
  const dueSoonCount = useMemo(() => {
    if (!plannerRows) return 0;
    const weekAhead = isoDatePlusDays(7);
    return plannerRows.filter(
      (item) => item.status !== "done" && item.dueDate != null && item.dueDate <= weekAhead
    ).length;
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
          dueSoonCount,
          allBuilds: allBuilds ?? [],
          focusedBuildId: focusedBuildId ?? null,
          followingFeed: (followingFeedRows ?? []) as FollowingFeedRow[],
        }
      : undefined;

  return (
    <DataBoundary<HomeLoaded> status={status} data={data} error={error}>
      {(loaded) => <HomeDashboardBody loaded={loaded} />}
    </DataBoundary>
  );
}

type FocusSheetRef = ComponentRef<typeof BottomSheetModal>;

/** Small photo tile for the studio / following shelves (prototype: 104×52, radius 9). */
function ShelfTile({
  name,
  meta,
  imageStorageId,
  imageUrl,
}: {
  name: string;
  meta?: string;
  imageStorageId: Id<"_storage"> | null;
  imageUrl: string | null;
}) {
  const hasImage = imageStorageId != null || imageUrl != null;
  return (
    <View
      style={{
        width: 104,
        height: 52,
        borderRadius: 9,
        overflow: "hidden",
        backgroundColor: glass.surface.active,
      }}
    >
      {hasImage ? (
        <ConvexStorageImage
          storageId={imageStorageId}
          imageUrl={imageUrl}
          className="absolute inset-0 h-full w-full"
          accessibilityLabel={name}
        />
      ) : null}
      <LinearGradient
        {...scrimGradientProps(glass.scrim.pageVertical)}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        pointerEvents="none"
      />
      <View style={{ position: "absolute", left: 8, right: 8, bottom: 5 }}>
        {meta ? (
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
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 11,
            color: glass.text.fg,
          }}
        >
          {name}
        </Text>
      </View>
    </View>
  );
}

/** Shelf eyebrow label (9px uppercase, prototype tracking). */
function ShelfEyebrow({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: APP_FONT_FAMILIES.sansBold,
        fontSize: 9,
        letterSpacing: ls(0.22, 9),
        textTransform: "uppercase",
        color: glass.text.fg70,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

function HomeDashboardBody({ loaded }: { loaded: HomeLoaded }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    recentBuild,
    upcoming,
    heroUri,
    otherOutfits,
    plannerPreview,
    dueSoonCount,
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

  const nextEvent = upcoming[0];

  const dateEyebrow = useMemo(() => {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: "long" }).format(now);
    const monthDay = new Intl.DateTimeFormat(i18n.language, {
      month: "long",
      day: "numeric",
    }).format(now);
    return `${weekday} · ${monthDay}`;
  }, [i18n.language]);

  /** Factual serif statement composed from real data — mirrors web home's headline. */
  const headline = useMemo(() => {
    const duePart =
      dueSoonCount === 0
        ? t("home.glassHeadlineDueZero", { defaultValue: "All caught up" })
        : dueSoonCount === 1
          ? t("home.glassHeadlineDueOne", { defaultValue: "One thing due" })
          : t("home.glassHeadlineDueOther", {
              defaultValue: "{{count}} things due",
              count: dueSoonCount,
            });
    if (!nextEvent) return `${duePart}.`;
    const days = daysUntil(nextEvent.convention.startDate);
    const eventPart =
      days <= 0
        ? t("home.glassHeadlineEventToday", {
            defaultValue: "{{event}} is today",
            event: nextEvent.convention.name,
          })
        : days === 1
          ? t("home.glassHeadlineEventOneDay", {
              defaultValue: "1 day to {{event}}",
              event: nextEvent.convention.name,
            })
          : t("home.glassHeadlineEventDays", {
              defaultValue: "{{days}} days to {{event}}",
              days,
              event: nextEvent.convention.name,
            });
    return `${duePart}, ${eventPart}.`;
  }, [dueSoonCount, nextEvent, t]);

  /** Agenda rows: overdue first, then dated soonest-first, undated last. */
  const agendaRows = useMemo(() => {
    return [...plannerPreview]
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate || b.dueDate) return a.dueDate ? -1 : 1;
        return 0;
      })
      .slice(0, 3);
  }, [plannerPreview]);

  const dueMeta = useCallback(
    (item: PlannerPreviewRow): { text: string; danger: boolean } => {
      if (item.overdue) return { text: t("home.overdue"), danger: true };
      if (!item.dueDate) return { text: t("home.noDueDate"), danger: false };
      const days = daysUntil(item.dueDate);
      if (days <= 0) return { text: t("home.glassDueToday", { defaultValue: "Today" }), danger: true };
      if (days === 1)
        return { text: t("home.glassDueTomorrow", { defaultValue: "Tomorrow" }), danger: false };
      const at = new Date(item.dueDate + "T12:00:00");
      if (days < 7) {
        return {
          text: new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(at),
          danger: false,
        };
      }
      return {
        text: new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }).format(at),
        danger: false,
      };
    },
    [i18n.language, t]
  );

  const eventRowMeta = useMemo(() => {
    if (!nextEvent) return null;
    const days = daysUntil(nextEvent.convention.startDate);
    return days <= 0
      ? t("home.glassEventRowMetaToday", {
          defaultValue: "{{count}} builds · today",
          count: nextEvent.outfitCount,
        })
      : t("home.glassEventRowMeta", {
          defaultValue: "{{count}} builds · {{days}} days",
          count: nextEvent.outfitCount,
          days,
        });
  }, [nextEvent, t]);

  const agendaDivider = {
    borderBottomWidth: 1,
    borderBottomColor: glass.border.divider,
  } as const;

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop
        imageStorageId={recentBuild?.imageStorageId ?? null}
        imageUrl={heroUri}
        focalX={recentBuild?.imageFocalX ?? null}
        focalY={recentBuild?.imageFocalY ?? null}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={glass.text.fg70}
          />
        }
      >
        {/* Headline block (prototype: left 22, top ~70) */}
        <View style={{ paddingHorizontal: 22, paddingTop: insets.top + 58 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 9,
              letterSpacing: ls(0.26, 9),
              textTransform: "uppercase",
              color: glass.text.fg,
              opacity: 0.75,
              marginBottom: 10,
            }}
          >
            {dateEyebrow}
          </Text>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 38,
              lineHeight: 38,
              color: glass.text.fg,
            }}
          >
            {headline}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 18,
            }}
          >
            <Link href={recentBuild ? APP_HREF.build(recentBuild._id) : APP_HREF.builds} asChild>
              <PhotoPill
                variant="solid"
                label={
                  recentBuild
                    ? t("home.glassOpenBuild", { defaultValue: "Open build" })
                    : t("home.browseOutfits")
                }
              />
            </Link>
            {allBuilds.length > 0 ? (
              <PhotoPill
                variant="outline"
                size="sm"
                label={t("home.selectFocus")}
                onPress={openFocusSheet}
              />
            ) : null}
          </View>
        </View>

        {/* What's due — agenda glass panel */}
        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <GlassPanel style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansBold,
                fontSize: 9,
                letterSpacing: ls(0.2, 9),
                textTransform: "uppercase",
                color: glass.text.fg,
                opacity: 0.6,
                marginBottom: 4,
              }}
            >
              {t("home.glassWhatsDue", { defaultValue: "What's due" })}
            </Text>

            {agendaRows.length === 0 ? (
              <View style={[{ paddingVertical: 12 }, agendaDivider]}>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 12,
                    color: glass.text.fg55,
                  }}
                >
                  {t("home.noOpenTasks")}
                </Text>
              </View>
            ) : (
              agendaRows.map((item) => {
                const meta = dueMeta(item);
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => openPlannerItem(item)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        minHeight: 44,
                        paddingVertical: 10,
                      },
                      agendaDivider,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: glass.border.strong,
                      }}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansRegular,
                          fontSize: 12,
                          color: glass.text.fg,
                        }}
                      >
                        {item.title}
                      </Text>
                      {item.buildName ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                            fontSize: 9,
                            letterSpacing: ls(0.14, 9),
                            textTransform: "uppercase",
                            color: glass.text.fg55,
                            marginTop: 2,
                          }}
                        >
                          {item.buildName}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        fontFamily: meta.danger
                          ? APP_FONT_FAMILIES.sansBold
                          : APP_FONT_FAMILIES.sansSemiBold,
                        fontSize: 9,
                        letterSpacing: ls(0.14, 9),
                        textTransform: "uppercase",
                        color: meta.danger ? glass.text.danger : glass.text.fg55,
                      }}
                    >
                      {meta.text}
                    </Text>
                  </Pressable>
                );
              })
            )}

            {nextEvent ? (
              <Link href={APP_HREF.convention(nextEvent.convention._id)} asChild>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 44,
                      paddingVertical: 10,
                    },
                    agendaDivider,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="calendar-outline" size={17} color={glass.text.fg70} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                        fontSize: 12,
                        color: glass.text.fg,
                      }}
                    >
                      {nextEvent.convention.name}
                    </Text>
                    {eventRowMeta ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.14, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg55,
                          marginTop: 2,
                        }}
                      >
                        {eventRowMeta}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={glass.text.fg45} />
                </Pressable>
              </Link>
            ) : null}

            <View style={{ marginTop: 6, marginBottom: 8 }}>
              <Link href={APP_HREF.planner} asChild>
                <PhotoPill variant="text" label={t("home.openPlanner")} />
              </Link>
            </View>
          </GlassPanel>
        </View>

        {/* In the studio — horizontal shelf of small photo tiles */}
        <View style={{ marginTop: 26 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <ShelfEyebrow>
              {t("home.glassInTheStudio", {
                defaultValue: "In the studio · {{count}}",
                count: allBuilds.length,
              })}
            </ShelfEyebrow>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
          >
            {otherOutfits.map((build) => (
              <Link key={build._id} href={APP_HREF.build(build._id)} asChild>
                <Pressable style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                  <ShelfTile
                    name={build.name}
                    imageStorageId={build.imageStorageId ?? null}
                    imageUrl={build.imageUrl ?? null}
                  />
                </Pressable>
              </Link>
            ))}
            <Link href={APP_HREF.builds} asChild>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    width: 104,
                    height: 52,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: glass.border.strong,
                    backgroundColor: glass.surface.field,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.16, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg70,
                  }}
                >
                  {t("home.viewAllBuilds")}
                </Text>
              </Pressable>
            </Link>
          </ScrollView>
        </View>

        {/* From people you follow — second shelf, same tile grammar */}
        {followingFeed.length > 0 ? (
          <View style={{ marginTop: 26 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <ShelfEyebrow>{t("home.followingFeed")}</ShelfEyebrow>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
            >
              {followingFeed.map((build) => {
                const owner = build.ownerUsername
                  ? `@${build.ownerUsername}`
                  : (build.ownerName ?? t("home.followingUnknownCreator"));
                return (
                  <Pressable
                    key={build._id}
                    onPress={() => router.push(APP_HREF.publicBuild(build._id))}
                    style={({ pressed }) => [pressed && { opacity: 0.85 }]}
                  >
                    <ShelfTile
                      name={build.name}
                      meta={owner}
                      imageStorageId={build.imageStorageId ?? null}
                      imageUrl={build.imageUrl ?? null}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <ChooseFocusSheet
        sheetRef={focusSheetRef}
        builds={allBuilds}
        focusedBuildId={focusedBuildId}
        onSelectMostRecent={onSelectMostRecent}
        onSelectBuild={onSelectFocusBuild}
      />
    </View>
  );
}
