import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_HREF } from "@/lib/appRoutes";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  countPackingProgress,
  countPlannedBuilds,
  enumerateConventionDays,
  formatDateRange,
  getConventionDayHeading,
  getCountdownMeta,
  resolveBuildForDate,
} from "@/screens/conventions/utils";
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
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const convention = useQuery(api.conventions.get, id ? { id: id as Id<"conventions"> } : "skip");
  const plans = useQuery(
    api.conventions.getPlan,
    id ? { conventionId: id as Id<"conventions"> } : "skip"
  );
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip");
  const packing = useQuery(
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
  const replacePlan = useMutation(api.conventions.replacePlan);
  const regeneratePacking = useMutation(api.conventions.regeneratePacking);
  const days = useMemo(
    () => enumerateConventionDays(convention.startDate, convention.endDate),
    [convention.endDate, convention.startDate]
  );
  const [selectedDay, setSelectedDay] = useState(days[0] ?? convention.startDate);
  const [assigningDay, setAssigningDay] = useState<string | null>(null);
  const [buildSearch, setBuildSearch] = useState("");
  const countdown = getCountdownMeta(convention.startDate);
  const selectedBuild = useMemo(
    () => resolveBuildForDate(plans, builds, selectedDay),
    [builds, plans, selectedDay]
  );
  const dayPacking = useMemo(
    () => packing.filter((item) => item.date === selectedDay || !item.date),
    [packing, selectedDay]
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
        <View>
          <SectionHeading
            eyebrow={t("conventions.eyebrow")}
            title={convention.name}
            action={
              <Pressable onPress={() => router.push(APP_HREF.conventionEdit(convention._id))}>
                <Text className="text-sm font-semibold text-kyar-text underline dark:text-kyar-dark-text">
                  {t("conventions.editAction")}
                </Text>
              </Pressable>
            }
          />
          <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {convention.location
              ? `${formatDateRange(convention.startDate, convention.endDate)} · ${convention.location}`
              : formatDateRange(convention.startDate, convention.endDate)}
          </Text>
        </View>

        <SurfaceCard className="overflow-hidden">
          <View className="relative h-64">
            <ConvexStorageImage
              storageId={convention.imageStorageId}
              imageUrl={convention.imageUrl}
              className="h-64 w-full"
              accessibilityLabel={convention.name}
            />
            <View className="absolute inset-0 bg-kyar-text/10 dark:bg-kyar-dark-text/10" />
            <View className="absolute left-4 top-4 rounded-full bg-kyar-bg/92 px-3 py-2 dark:bg-kyar-dark-bg/92">
              <MetaLabel>{t("common.events")}</MetaLabel>
            </View>
            <View className="absolute right-4 top-4 rounded-full bg-kyar-accent px-3 py-2">
              <Text className="text-xs font-semibold text-kyar-bg">{countdown.label}</Text>
            </View>
            <View className="absolute inset-x-4 bottom-4 rounded-[28px] bg-kyar-bg/92 px-4 py-4 dark:bg-kyar-dark-bg/92">
              <View className="flex-row gap-3">
                <MetricCard label={t("conventions.metricBuilds")} value={plannedBuilds} />
                <MetricCard
                  label={t("conventions.metricPacking")}
                  value={`${packingProgress.checked}/${packingProgress.total}`}
                />
                <MetricCard label={t("conventions.metricDays")} value={days.length} />
              </View>
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <MetaLabel>{t("conventions.dayPlansTitle")}</MetaLabel>
            <Pressable onPress={() => router.push(APP_HREF.itinerary)}>
              <Text className="text-xs font-semibold text-kyar-text underline dark:text-kyar-dark-text">
                {t("conventions.itineraryTitle")}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-4"
            contentContainerClassName="gap-2"
          >
            {days.map((date, index) => (
              <Pressable
                key={date}
                onPress={() => setSelectedDay(date)}
                className={`rounded-full border px-4 py-3 ${
                  selectedDay === date
                    ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                    : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                }`}
              >
                <Text
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    selectedDay === date
                      ? "text-kyar-bg dark:text-kyar-dark-bg"
                      : "text-kyar-text dark:text-kyar-dark-text"
                  }`}
                >
                  {getConventionDayHeading(date, index)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <SurfaceCard className="mt-4 px-4 py-4">
            <MetaLabel>{t("conventions.selectedDayLabel")}</MetaLabel>
            <Text className="mt-2 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {selectedDay}
            </Text>

            {selectedBuild ? (
              <View className="mt-4 flex-row items-center gap-3">
                <ConvexStorageImage
                  storageId={selectedBuild.imageStorageId}
                  imageUrl={selectedBuild.imageUrl}
                  className="h-20 w-20 rounded-2xl"
                  accessibilityLabel={selectedBuild.name}
                />
                <View className="min-w-0 flex-1">
                  <MetaLabel>{selectedBuild.status ?? "Build"}</MetaLabel>
                  <Text className="mt-2 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                    {selectedBuild.name}
                  </Text>
                  {selectedBuild.character ? (
                    <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {selectedBuild.character}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text className="mt-4 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("conventions.unassignedDay")}
              </Text>
            )}

            <View className="mt-4 flex-row gap-3">
              <Button
                title={
                  selectedBuild
                    ? t("conventions.changeBuildAction")
                    : t("conventions.assignBuildAction")
                }
                variant="secondary"
                onPress={() => setAssigningDay(selectedDay)}
                className="flex-1"
              />
              {selectedBuild ? (
                <Button
                  title={t("conventions.openBuildAction")}
                  onPress={() => router.push(APP_HREF.build(selectedBuild._id))}
                  className="flex-1"
                />
              ) : null}
            </View>
          </SurfaceCard>
        </SurfaceCard>

        <SurfaceCard className="px-4 py-4">
          <View className="flex-row items-center justify-between">
            <MetaLabel>{t("conventions.dayPackingTitle")}</MetaLabel>
            <Pressable
              onPress={() => router.push(APP_HREF.conventionPacking(convention._id, selectedDay))}
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
              title={assigningDay ?? ""}
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

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 rounded-2xl bg-kyar-panel px-3 py-3 dark:bg-kyar-dark-panel">
      <MetaLabel>{label}</MetaLabel>
      <Text className="mt-2 text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
        {value}
      </Text>
    </View>
  );
}
