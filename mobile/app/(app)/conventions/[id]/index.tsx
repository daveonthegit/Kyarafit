import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_HREF } from "@/lib/appRoutes";
import {
  countPackingProgress,
  enumerateConventionDays,
  formatConventionTimelineDate,
  formatDateRange,
  formatLongDateLabel,
  getDaysUntil,
} from "@/screens/conventions/utils";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { DataBoundary } from "@/ui";
import {
  GlassPanel,
  GlassStatusChip,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
} from "@/ui/glass";

type Ready = {
  userId: string;
  convention: Doc<"conventions">;
  plans: Doc<"conventionDayPlans">[];
  builds: (Doc<"builds"> & {
    tasksTotal: number;
    tasksChecked: number;
    workflowProgressPercent: number;
    packingProgressPercent?: number;
    nodeProgressPercent?: number;
    totalCostCents: number;
  })[];
  packing: (Doc<"packingListItems"> & { checked: boolean })[];
};

const DAY_TILE_WIDTH = 170;
const DAY_TILE_HEIGHT = 190;

export default function ConventionDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const convention = useOfflineQuery(
    api.conventions.get,
    id ? { id: id as Id<"conventions"> } : "skip"
  );
  const plans = useOfflineQuery(
    api.conventions.getPlan,
    id ? { conventionId: id as Id<"conventions"> } : "skip"
  );
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");
  const packing = useOfflineQuery(
    api.conventions.getPacking,
    id ? { conventionId: id as Id<"conventions"> } : "skip"
  );

  const loading =
    identity === undefined ||
    (userId != null &&
      (convention === undefined ||
        plans === undefined ||
        builds === undefined ||
        packing === undefined));
  const error =
    identity === null
      ? new Error(t("builds.loadError"))
      : convention === null
        ? new Error(t("conventions.notFound"))
        : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || !convention || !plans || !builds || !packing) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && userId && convention && plans && builds && packing
      ? { userId, convention, plans, builds, packing }
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: convention?.name ?? t("common.events") }} />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <ConventionDetailBody {...loaded} />}
      </DataBoundary>
    </>
  );
}

/** Uppercase tracked meta on photo/glass (QA-2 floors: ≥9px, ≥0.14em). */
function Meta({
  children,
  size = 9,
  color = glass.text.fg70,
  tracking = 0.16,
  style,
}: {
  children: string;
  size?: number;
  color?: string;
  tracking?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: size,
          letterSpacing: ls(tracking, size),
          textTransform: "uppercase",
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function ConventionDetailBody({ userId, convention, plans, builds, packing }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const replacePlan = useOfflineMutation(api.conventions.replacePlan);
  const regeneratePacking = useOfflineMutation(api.conventions.regeneratePacking);
  const updatePackingItem = useOfflineMutation(api.conventions.updatePackingItem);
  const updateConvention = useOfflineMutation(api.conventions.update);
  const removeConvention = useOfflineMutation(api.conventions.remove);
  const days = useMemo(
    () => enumerateConventionDays(convention.startDate, convention.endDate),
    [convention.endDate, convention.startDate]
  );
  const [assigningDay, setAssigningDay] = useState<string | null>(null);
  const [buildSearch, setBuildSearch] = useState("");
  const primaryDay = days[0] ?? convention.startDate;
  const planByDate = useMemo(() => new Map(plans.map((p) => [p.date, p])), [plans]);
  const dayPacking = useMemo(
    () => packing.filter((item) => item.date === primaryDay || !item.date),
    [packing, primaryDay]
  );
  const packingProgress = countPackingProgress(packing);
  const packingPct =
    packingProgress.total > 0
      ? Math.round((100 * packingProgress.checked) / packingProgress.total)
      : 0;
  const plannedDayCount = useMemo(
    () => days.filter((date) => planByDate.get(date)?.buildId).length,
    [days, planByDate]
  );
  const daysUntil = getDaysUntil(convention.startDate);
  const countdownLabel =
    daysUntil > 0
      ? t("conventions.countdownDays", { defaultValue: "{{count}} days", count: daysUntil })
      : daysUntil === 0
        ? t("conventions.countdownToday", { defaultValue: "Today" })
        : t("conventions.countdownStarted", {
            defaultValue: "{{count}} days ago",
            count: Math.abs(daysUntil),
          });
  const firstUnplanned = days.find((date) => !planByDate.get(date)?.buildId) ?? days[0];

  const assignBuild = useCallback(
    async (buildId: Id<"builds"> | undefined) => {
      try {
        await replacePlan({
          userId,
          conventionId: convention._id,
          plan: days.map((date) => {
            const current = plans.find((entry) => entry.date === date);
            return {
              date,
              buildId: date === assigningDay ? buildId : current?.buildId,
              notes: current?.notes,
            };
          }),
        });
        setAssigningDay(null);
        setBuildSearch("");
      } catch (error) {
        Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
      }
    },
    [assigningDay, convention._id, days, plans, replacePlan, t, userId]
  );

  const filteredBuilds = useMemo(() => {
    const query = buildSearch.trim().toLowerCase();
    if (!query) return builds;
    return builds.filter(
      (build) =>
        build.name.toLowerCase().includes(query) ||
        (build.character ?? "").toLowerCase().includes(query)
    );
  }, [buildSearch, builds]);

  const runArchive = useCallback(async () => {
    try {
      await updateConvention({
        id: convention._id,
        userId,
        archived: true,
      });
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  }, [convention._id, t, updateConvention, userId]);

  const runUnarchive = useCallback(async () => {
    try {
      await updateConvention({
        id: convention._id,
        userId,
        archived: false,
      });
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  }, [convention._id, t, updateConvention, userId]);

  const confirmArchive = useCallback(() => {
    Alert.alert(t("conventions.archiveConfirmTitle"), t("conventions.archiveConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("conventions.archiveAction"), style: "default", onPress: () => void runArchive() },
    ]);
  }, [runArchive, t]);

  const confirmDelete = useCallback(() => {
    Alert.alert(t("conventions.deleteConfirmTitle"), t("conventions.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("conventions.deleteAction"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await removeConvention({ id: convention._id, userId });
              router.replace(APP_HREF.conventions);
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            }
          })();
        },
      },
    ]);
  }, [convention._id, removeConvention, router, t, userId]);

  const openManageMenu = useCallback(() => {
    Alert.alert(t("conventions.manageTitle"), undefined, [
      convention.archived === true
        ? {
            text: t("conventions.unarchiveAction"),
            onPress: () => void runUnarchive(),
          }
        : { text: t("conventions.archiveAction"), onPress: confirmArchive },
      { text: t("conventions.deleteAction"), style: "destructive", onPress: confirmDelete },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }, [confirmArchive, confirmDelete, convention.archived, runUnarchive, t]);

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop
        imageStorageId={convention.imageStorageId}
        imageUrl={convention.imageUrl}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: 48 }}
      >
        {/* Headline block (ref 8a) */}
        <View style={{ paddingHorizontal: 22 }}>
          <Meta size={9} tracking={0.26}>
            {`${formatDateRange(convention.startDate, convention.endDate)}${
              convention.location ? ` · ${convention.location}` : ""
            }`}
          </Meta>
          <Text
            numberOfLines={3}
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontStyle: "italic",
              fontSize: 38,
              lineHeight: 42,
              color: glass.text.fg,
            }}
          >
            {convention.name}
          </Text>

          {/* Meta triplet: Countdown / Builds / Status */}
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 18,
              rowGap: 8,
            }}
          >
            <Meta size={9} tracking={0.2}>
              {`${t("conventions.countdownLabel", { defaultValue: "Countdown" })} · ${countdownLabel}`}
            </Meta>
            <Meta size={9} tracking={0.2}>
              {`${t("conventions.metricBuilds")} · ${t("conventions.plannedDaysMeta", {
                defaultValue: "{{planned}}/{{total}} days",
                planned: plannedDayCount,
                total: days.length,
              })}`}
            </Meta>
            {packingProgress.total === 0 ? (
              <GlassStatusChip
                tone="warning"
                label={t("conventions.timelineStatusLogistics")}
              />
            ) : (
              <Meta
                size={9}
                tracking={0.2}
                color={
                  packingProgress.checked === packingProgress.total
                    ? glass.chip.done.fg
                    : glass.text.fg70
                }
              >
                {`${t("conventions.packingEyebrow")} · ${packingProgress.checked}/${packingProgress.total}`}
              </Meta>
            )}
            {convention.archived === true ? (
              <GlassStatusChip tone="neutral" label={t("conventions.archivedBadge")} />
            ) : null}
          </View>

          {/* Actions: exactly ONE solid + icon pill affordances */}
          <View
            style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <PhotoPill
              variant="solid"
              label={t("conventions.planDayAction", { defaultValue: "Plan a day" })}
              onPress={() => setAssigningDay(firstUnplanned ?? primaryDay)}
            />
            <Pressable
              onPress={() => router.push(APP_HREF.conventionEdit(convention._id))}
              accessibilityRole="button"
              accessibilityLabel={t("conventions.editAction")}
              className="active:opacity-80"
              style={{
                height: 44,
                width: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: glass.border.strong,
                backgroundColor: glass.surface.bar,
              }}
            >
              <Ionicons name="pencil-outline" size={17} color={glass.text.fg} />
            </Pressable>
            <Pressable
              onPress={openManageMenu}
              accessibilityRole="button"
              accessibilityLabel={t("conventions.manageTitle")}
              className="active:opacity-80"
              style={{
                height: 44,
                width: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: glass.border.strong,
                backgroundColor: glass.surface.bar,
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={17} color={glass.text.fg} />
            </Pressable>
          </View>
        </View>

        {/* Day-plan rail (ref 8a): one photo tile per day; dashed = assign */}
        <View style={{ marginTop: 26 }}>
          <View
            style={{
              paddingHorizontal: 22,
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Meta size={10} tracking={0.24} color={glass.text.fg}>
              {`${t("conventions.dayPlansTitle")} · ${days.length}`}
            </Meta>
            <Pressable
              onPress={() => router.push(APP_HREF.itinerary)}
              hitSlop={10}
              className="active:opacity-80"
              style={{ minHeight: 32, justifyContent: "center" }}
            >
              <Meta
                size={9}
                color={glass.text.fg70}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: glass.border.strong,
                  paddingBottom: 2,
                }}
              >
                {t("conventions.itineraryTitle")}
              </Meta>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12 }}
            contentContainerStyle={{ paddingHorizontal: 22, gap: 12 }}
          >
            {days.map((date, idx) => {
              const entry = planByDate.get(date);
              const build = entry?.buildId
                ? builds.find((b) => b._id === entry.buildId)
                : undefined;
              const dayEyebrow = `${t("conventions.timelineDayHeading", { n: idx + 1 })} · ${formatLongDateLabel(date)}`;
              const buildPackingItems = entry?.buildId
                ? packing.filter((item) => item.buildId === entry.buildId)
                : [];
              const dayPacked = buildPackingItems.filter((item) => item.checked).length;

              if (!build) {
                // Dashed outline is the add affordance (QA-6).
                return (
                  <Pressable
                    key={date}
                    onPress={() => setAssigningDay(date)}
                    accessibilityRole="button"
                    accessibilityLabel={`${dayEyebrow}: ${t("conventions.assignBuildTile", {
                      defaultValue: "Assign a build",
                    })}`}
                    className="active:opacity-80"
                    style={{
                      width: DAY_TILE_WIDTH,
                      height: DAY_TILE_HEIGHT,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: glass.border.strong,
                    }}
                  >
                    <Ionicons name="add" size={22} color={glass.text.fg70} />
                    <Meta size={9} color={glass.text.fg}>
                      {dayEyebrow}
                    </Meta>
                    <Meta size={9} color={glass.text.fg70}>
                      {t("conventions.assignBuildTile", { defaultValue: "Assign a build" })}
                    </Meta>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={date}
                  onPress={() => router.push(APP_HREF.build(build._id))}
                  onLongPress={() => setAssigningDay(date)}
                  delayLongPress={400}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayEyebrow}: ${build.name}`}
                  className="active:opacity-90"
                  style={{
                    width: DAY_TILE_WIDTH,
                    height: DAY_TILE_HEIGHT,
                    borderRadius: 10,
                    overflow: "hidden",
                    borderWidth: borderWidth.hairline,
                    borderColor: glass.border.divider,
                    backgroundColor: glass.surface.active,
                  }}
                >
                  {build.imageStorageId || build.imageUrl ? (
                    <ConvexStorageImage
                      storageId={build.imageStorageId}
                      imageUrl={build.imageUrl}
                      className="h-full w-full"
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="image-outline" size={30} color={glass.text.fg45} />
                    </View>
                  )}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: glass.scrimDim,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  >
                    <Meta size={9}>{dayEyebrow}</Meta>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 3,
                        fontFamily: APP_FONT_FAMILIES.displayItalic,
                        fontStyle: "italic",
                        fontSize: 14,
                        lineHeight: 17,
                        color: glass.text.fg,
                      }}
                    >
                      {build.name}
                    </Text>
                    <Meta
                      size={9}
                      tracking={0.14}
                      color={
                        buildPackingItems.length === 0
                          ? glass.chip.warn.fg
                          : dayPacked === buildPackingItems.length
                            ? glass.chip.done.fg
                            : glass.text.fg70
                      }
                      style={{ marginTop: 3 }}
                    >
                      {buildPackingItems.length === 0
                        ? t("conventions.timelineStatusLogistics")
                        : t("conventions.timelineStatusPacking", {
                            packed: dayPacked,
                            total: buildPackingItems.length,
                          })}
                    </Meta>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Packing work panel (ref 8a) — the ONE glass panel on this screen */}
        <View style={{ marginTop: 26, paddingHorizontal: 16 }}>
          <GlassPanel>
            <View
              style={{
                paddingHorizontal: 18,
                paddingVertical: 14,
                borderBottomWidth: borderWidth.hairline,
                borderBottomColor: glass.border.dividerStrong,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Meta size={10} tracking={0.24} color={glass.text.fg}>
                  {t("conventions.packingListTitle", { defaultValue: "Packing list" })}
                </Meta>
                <Pressable
                  onPress={() => void regeneratePacking({ userId, conventionId: convention._id })}
                  hitSlop={10}
                  className="active:opacity-80"
                  style={{ minHeight: 32, justifyContent: "center" }}
                >
                  <Meta
                    size={9}
                    color={glass.text.fg70}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: glass.border.strong,
                      paddingBottom: 2,
                    }}
                  >
                    {t("conventions.regeneratePackingAction")}
                  </Meta>
                </Pressable>
              </View>
              {packingProgress.total > 0 ? (
                <View
                  style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <View
                    style={{
                      height: 2,
                      flex: 1,
                      borderRadius: 1,
                      backgroundColor: glass.border.default,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: 2,
                        width: `${packingPct}%`,
                        borderRadius: 1,
                        backgroundColor: glass.surface.solid,
                      }}
                    />
                  </View>
                  <Meta size={9} color={glass.text.fg55}>
                    {t("conventions.packedCountMeta", {
                      defaultValue: "{{checked}} / {{total}} packed",
                      checked: packingProgress.checked,
                      total: packingProgress.total,
                    })}
                  </Meta>
                </View>
              ) : null}
            </View>

            <View style={{ paddingHorizontal: 18, paddingVertical: 8 }}>
              {dayPacking.length === 0 ? (
                <Text
                  style={{
                    paddingVertical: 12,
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 13,
                    lineHeight: 19,
                    color: glass.text.fg55,
                  }}
                >
                  {t("conventions.noPackingItems")}
                </Text>
              ) : (
                dayPacking.slice(0, 5).map((item, index) => (
                  <Pressable
                    key={item._id}
                    onPress={() =>
                      void updatePackingItem({ id: item._id, userId, checked: !item.checked })
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.checked }}
                    className="active:opacity-80"
                    style={{
                      minHeight: 44,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderTopWidth: index === 0 ? 0 : borderWidth.hairline,
                      borderTopColor: glass.border.divider,
                      paddingVertical: 10,
                    }}
                  >
                    <View
                      style={{
                        height: 18,
                        width: 18,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 4,
                        borderWidth: item.checked ? 0 : 1.5,
                        borderColor: glass.text.fg55,
                        backgroundColor: item.checked ? glass.surface.solid : "transparent",
                      }}
                    >
                      {item.checked ? (
                        <Ionicons name="checkmark" size={12} color={glass.text.ink} />
                      ) : null}
                    </View>
                    {/* Sentence-case body — content is never meta (QA-4). */}
                    <Text
                      numberOfLines={1}
                      style={{
                        minWidth: 0,
                        flex: 1,
                        fontFamily: APP_FONT_FAMILIES.sansRegular,
                        fontSize: 13,
                        color: item.checked ? glass.text.fg55 : glass.text.fg,
                        textDecorationLine: item.checked ? "line-through" : "none",
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            <View
              style={{
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.dividerStrong,
                paddingHorizontal: 18,
                paddingVertical: 12,
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                columnGap: 18,
                rowGap: 8,
              }}
            >
              <Pressable
                onPress={() => router.push(APP_HREF.conventionPacking(convention._id, primaryDay))}
                hitSlop={8}
                className="active:opacity-80"
                style={{ minHeight: 32, justifyContent: "center" }}
              >
                <Meta
                  size={10}
                  color={glass.text.fg70}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: glass.border.strong,
                    paddingBottom: 2,
                  }}
                >
                  {t("conventions.openPackingAction")}
                </Meta>
              </Pressable>
              <Pressable
                onPress={() => router.push(APP_HREF.packing)}
                hitSlop={8}
                className="active:opacity-80"
                style={{ minHeight: 32, justifyContent: "center" }}
              >
                <Meta
                  size={10}
                  color={glass.text.fg70}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: glass.border.strong,
                    paddingBottom: 2,
                  }}
                >
                  {t("conventions.crossPackingTitle")}
                </Meta>
              </Pressable>
            </View>
          </GlassPanel>
        </View>
      </ScrollView>

      {/* Assign-build picker — heavier-glass sheet */}
      <Modal
        visible={assigningDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setAssigningDay(null)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
          onPress={() => setAssigningDay(null)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              maxHeight: "82%",
              borderTopLeftRadius: glass.radius.sheet,
              borderTopRightRadius: glass.radius.sheet,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.overlay,
              backgroundColor: glass.fallback.overlay,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 32,
            }}
          >
            <Meta size={9} color={glass.text.fg55} tracking={0.2}>
              {t("conventions.assignBuildAction")}
            </Meta>
            <Text
              style={{
                marginTop: 6,
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                fontStyle: "italic",
                fontSize: 24,
                lineHeight: 28,
                color: glass.text.fg,
              }}
            >
              {assigningDay ? formatConventionTimelineDate(assigningDay) : ""}
            </Text>
            <Text
              style={{
                marginTop: 10,
                fontFamily: APP_FONT_FAMILIES.sansRegular,
                fontSize: 13,
                lineHeight: 19,
                color: glass.text.fg70,
              }}
            >
              {t("conventions.assignBuildSubtitle")}
            </Text>

            <View style={{ marginTop: 14 }}>
              <GlassTextField
                value={buildSearch}
                onChangeText={setBuildSearch}
                placeholder={t("conventions.buildSearchPlaceholder")}
              />
            </View>

            <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              <Pressable
                onPress={() => void assignBuild(undefined)}
                accessibilityRole="button"
                className="active:opacity-80"
                style={{
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: glass.border.strong,
                  backgroundColor: glass.surface.bar,
                }}
              >
                <Meta size={10} color={glass.text.fg}>
                  {t("conventions.clearBuildAction")}
                </Meta>
              </Pressable>

              {filteredBuilds.map((build) => (
                <Pressable
                  key={build._id}
                  onPress={() => void assignBuild(build._id)}
                  accessibilityRole="button"
                  className="active:opacity-80"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 12,
                    borderWidth: borderWidth.hairline,
                    borderColor: glass.border.default,
                    backgroundColor: glass.surface.field,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      height: 52,
                      width: 52,
                      borderRadius: 8,
                      overflow: "hidden",
                      backgroundColor: glass.surface.active,
                    }}
                  >
                    <ConvexStorageImage
                      storageId={build.imageStorageId}
                      imageUrl={build.imageUrl}
                      className="h-full w-full"
                      accessibilityLabel={build.name}
                    />
                  </View>
                  <View style={{ minWidth: 0, flex: 1 }}>
                    {build.character ? (
                      <Meta size={9} color={glass.text.fg55}>
                        {build.character}
                      </Meta>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: build.character ? 3 : 0,
                        fontFamily: APP_FONT_FAMILIES.displayItalic,
                        fontStyle: "italic",
                        fontSize: 16,
                        lineHeight: 19,
                        color: glass.text.fg,
                      }}
                    >
                      {build.name}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={glass.text.fg45} />
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
