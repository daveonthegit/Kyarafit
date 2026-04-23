import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { BuildPortfolioCard } from "@/components/builds/BuildPortfolioCard";
import { ConventionEventPoster } from "@/components/conventions/ConventionEventPoster";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_HREF } from "@/lib/appRoutes";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  countPackingProgress,
  countPlannedBuilds,
  enumerateConventionDays,
  formatConventionTimelineDate,
} from "@/screens/conventions/utils";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

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

function ConventionDetailBody({ userId, convention, plans, builds, packing }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useDesignTheme();
  const replacePlan = useOfflineMutation(api.conventions.replacePlan);
  const regeneratePacking = useOfflineMutation(api.conventions.regeneratePacking);
  const days = useMemo(
    () => enumerateConventionDays(convention.startDate, convention.endDate),
    [convention.endDate, convention.startDate]
  );
  const [assigningDay, setAssigningDay] = useState<string | null>(null);
  const [buildSearch, setBuildSearch] = useState("");
  const primaryDay = days[0] ?? convention.startDate;
  const planByDate = useMemo(() => new Map(plans.map((p) => [p.date, p])), [plans]);
  const [timelineBlockHeight, setTimelineBlockHeight] = useState(0);
  const dayPacking = useMemo(
    () => packing.filter((item) => item.date === primaryDay || !item.date),
    [packing, primaryDay]
  );
  const packingProgress = countPackingProgress(packing);
  const plannedBuilds = countPlannedBuilds(plans);

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

  return (
    <>
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 40,
          gap: 20,
        }}
      >
        <ConventionEventPoster
          name={convention.name}
          startDate={convention.startDate}
          endDate={convention.endDate}
          location={convention.location}
          imageStorageId={convention.imageStorageId}
          imageUrl={convention.imageUrl}
          plannedBuilds={plannedBuilds}
          packingChecked={packingProgress.checked}
          packingTotal={packingProgress.total}
          daysCount={days.length}
          metricBuildsLabel={t("conventions.metricBuilds")}
          metricPackingLabel={t("conventions.metricPacking")}
          metricDaysLabel={t("conventions.metricDays")}
          topAccessory={
            <Pressable
              onPress={() => router.push(APP_HREF.conventionEdit(convention._id))}
              hitSlop={10}
              className="active:opacity-80"
            >
              <Text className="text-sm font-semibold text-kyar-bg">{t("conventions.editAction")}</Text>
            </Pressable>
          }
        />

        {/* Cosplay timeline — structure aligned with web `/conventions/[id]` (vertical spine + nodes + cards) */}
        <View className="mb-4">
          <View className="mb-6 flex-row items-center justify-between border-b border-kyar-borderSubtle pb-3 dark:border-kyar-dark-borderSubtle">
            <Text
              style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
              className="text-[9px] uppercase tracking-[0.2em] text-kyar-text dark:text-kyar-dark-text"
            >
              {t("conventions.timelineTitle")}
            </Text>
            <Pressable onPress={() => router.push(APP_HREF.itinerary)} hitSlop={8}>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-accent">
                {t("conventions.itineraryTitle")}
              </Text>
            </Pressable>
          </View>

          <View
            className="relative"
            onLayout={(e) => setTimelineBlockHeight(e.nativeEvent.layout.height)}
          >
            {timelineBlockHeight > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 11,
                  top: 0,
                  width: 2,
                  height: timelineBlockHeight,
                  backgroundColor: colors.borderSubtle,
                  zIndex: 0,
                }}
              />
            ) : null}

            {days.map((date, idx) => {
              const entry = planByDate.get(date);
              const build = entry?.buildId
                ? builds.find((b) => b._id === entry.buildId)
                : undefined;

              return (
                <View
                  key={date}
                  className={`relative z-[1] flex-row pb-12 ${idx === days.length - 1 ? "pb-2" : ""}`}
                >
                  <View className="z-[2] w-6 items-center">
                    <View className="h-6 w-6 items-center justify-center rounded-full border-[3px] border-kyar-bg bg-kyar-text dark:border-kyar-dark-bg dark:bg-kyar-dark-text">
                      <Text className="text-[8px] font-bold text-kyar-bg dark:text-kyar-dark-bg">
                        {idx + 1}
                      </Text>
                    </View>
                  </View>

                  <View className="min-w-0 flex-1 pl-4">
                    <Text
                      style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                      className="text-xl font-bold italic text-kyar-text dark:text-kyar-dark-text"
                    >
                      {t("conventions.timelineDayHeading", { n: idx + 1 })}
                    </Text>
                    <Text className="mt-1 text-[9px] uppercase tracking-wider text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                      {formatConventionTimelineDate(date)}
                    </Text>

                    <Pressable
                      onPress={() =>
                        build
                          ? router.push(APP_HREF.build(build._id))
                          : setAssigningDay(date)
                      }
                      onLongPress={build ? () => setAssigningDay(date) : undefined}
                      delayLongPress={400}
                      className="mt-3 active:opacity-95"
                    >
                      {build ? (
                        <BuildPortfolioCard
                          variant="comfortable"
                          projectIndex={idx + 1}
                          item={{
                            name: build.name,
                            character: build.character,
                            status: build.status ?? "",
                            imageStorageId: build.imageStorageId,
                            imageUrl: build.imageUrl,
                            tasksTotal: build.tasksTotal,
                            tasksChecked: build.tasksChecked,
                          }}
                        />
                      ) : (
                        <View className="aspect-[3/2] items-center justify-center border border-dashed border-kyar-borderSubtle bg-kyar-muted/40 px-6 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted/40">
                          <Ionicons
                            name="add-circle-outline"
                            size={28}
                            color={colors.textTertiary}
                          />
                          <Text
                            style={{ fontFamily: APP_FONT_FAMILIES.sansBold }}
                            className="mt-2 text-[10px] uppercase tracking-widest text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
                          >
                            {t("conventions.restDay")}
                          </Text>
                          <Text className="mt-1 text-[9px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                            {t("conventions.timelineTapToAssign")}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <SurfaceCard className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <MetaLabel>{t("conventions.dayPackingTitle")}</MetaLabel>
            <Pressable
              onPress={() =>
                router.push(APP_HREF.conventionPacking(convention._id, primaryDay))
              }
            >
              <Text className="text-xs font-semibold text-kyar-text underline dark:text-kyar-dark-text">
                {t("conventions.openPackingAction")}
              </Text>
            </Pressable>
          </View>

          <Text className="mt-3 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("conventions.packingHint")}
          </Text>

          <View className="mt-4 gap-3">
            {dayPacking.length === 0 ? (
              <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("conventions.noPackingItems")}
              </Text>
            ) : (
              dayPacking.slice(0, 4).map((item) => (
                <View
                  key={item._id}
                  className="flex-row items-center gap-3 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-3 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                >
                  <View
                    className={`h-7 w-7 items-center justify-center rounded-full border ${
                      item.checked
                        ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                        : "border-kyar-border dark:border-kyar-dark-border"
                    }`}
                  >
                    {item.checked ? (
                      <Ionicons name="checkmark" size={14} color={colors.bg} />
                    ) : null}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
                      {item.label}
                    </Text>
                    <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {item.date ?? t("conventions.generalPacking")}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View className="mt-4 flex-row gap-3">
            <Button
              title={t("conventions.regeneratePackingAction")}
              variant="secondary"
              onPress={() => void regeneratePacking({ userId, conventionId: convention._id })}
              className="flex-1"
            />
            <Button
              title={t("conventions.crossPackingTitle")}
              variant="secondary"
              onPress={() => router.push(APP_HREF.packing)}
              className="flex-1"
            />
          </View>
        </SurfaceCard>
      </ScrollView>

      <Modal
        visible={assigningDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setAssigningDay(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-kyar-text/20 dark:bg-kyar-dark-text/20"
          onPress={() => setAssigningDay(null)}
        >
          <Pressable
            className="max-h-[82%] rounded-t-[32px] bg-kyar-bg px-5 pb-8 pt-5 dark:bg-kyar-dark-bg"
            onPress={(event) => event.stopPropagation()}
          >
            <SectionHeading
              eyebrow={t("conventions.assignBuildAction")}
              title={assigningDay ? formatConventionTimelineDate(assigningDay) : ""}
            />
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("conventions.assignBuildSubtitle")}
            </Text>

            <TextInput
              value={buildSearch}
              onChangeText={setBuildSearch}
              placeholder={t("conventions.buildSearchPlaceholder")}
              placeholderTextColor={colors.textTertiary}
              className="mt-4 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
            />

            <ScrollView className="mt-4" contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              <Button
                title={t("conventions.clearBuildAction")}
                variant="secondary"
                onPress={() => void assignBuild(undefined)}
              />

              {filteredBuilds.map((build) => (
                <Pressable
                  key={build._id}
                  onPress={() => void assignBuild(build._id)}
                  className="flex-row items-center gap-3 rounded-3xl border border-kyar-borderSubtle bg-kyar-surface px-3 py-3 active:opacity-90 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                >
                  <ConvexStorageImage
                    storageId={build.imageStorageId}
                    imageUrl={build.imageUrl}
                    className="h-16 w-16 rounded-2xl"
                    accessibilityLabel={build.name}
                  />
                  <View className="min-w-0 flex-1">
                    <MetaLabel>{build.status ?? "Build"}</MetaLabel>
                    <Text className="mt-2 text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                      {build.name}
                    </Text>
                    {build.character ? (
                      <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {build.character}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

