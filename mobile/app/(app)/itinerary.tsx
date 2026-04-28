import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { MobilePageHeader } from "@/components/navigation/MobilePageHeader";
import { APP_HREF } from "@/lib/appRoutes";
import { useOfflineQuery } from "@/offline";
import {
  enumerateConventionDays,
  formatLongDateLabel,
  type ConventionWithDetails,
} from "@/screens/conventions/utils";
import { DataBoundary, MetaLabel, SurfaceCard } from "@/ui";

type Ready = {
  conventions: ConventionWithDetails[];
  builds: (Doc<"builds"> & {
    tasksTotal: number;
    tasksChecked: number;
    workflowProgressPercent: number;
    packingProgressPercent?: number;
    nodeProgressPercent?: number;
    totalCostCents: number;
  })[];
};

export default function ItineraryScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const conventions = useOfflineQuery(
    api.conventions.listWithDetails,
    userId ? { userId } : "skip"
  );
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");

  const loading =
    identity === undefined ||
    (userId != null && (conventions === undefined || builds === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || !conventions || !builds || conventions.length === 0) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && conventions && builds
      ? { conventions: conventions as ConventionWithDetails[], builds }
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t("conventions.itineraryTitle"), headerShown: true }} />
      <MobilePageHeader
        eyebrow={t("nav.events")}
        title={t("conventions.itineraryTitle")}
        subtitle={t("conventions.itinerarySubtitle")}
        fallbackHref={APP_HREF.home}
        containerClassName="px-5 pt-4"
      />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <ItineraryBody {...loaded} />}
      </DataBoundary>
    </>
  );
}

function ItineraryBody({ conventions, builds }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();

  const rows = conventions
    .filter((convention) => convention.archived !== true)
    .flatMap((convention) =>
      enumerateConventionDays(convention.startDate, convention.endDate).map((date) => {
        const dayPlan = convention.plans.find((entry) => entry.date === date);
        const build = dayPlan?.buildId
          ? builds.find((item) => item._id === (dayPlan.buildId as Id<"builds">))
          : null;
        return {
          key: `${convention._id}-${date}`,
          date,
          convention,
          build,
        };
      })
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 }}
    >
      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={() => router.push(APP_HREF.convention(row.convention._id))}
          className="active:opacity-90"
        >
          <SurfaceCard className="px-4 py-4">
            <MetaLabel>{formatLongDateLabel(row.date)}</MetaLabel>
            <Text className="mt-2 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {row.convention.name}
            </Text>
            <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {row.convention.location ?? t("conventions.noLocation")}
            </Text>
            <View className="mt-4 rounded-2xl bg-kyar-panel px-3 py-3 dark:bg-kyar-dark-panel">
              <MetaLabel>{t("conventions.itineraryBuildLabel")}</MetaLabel>
              <Text className="mt-2 text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                {row.build?.name ?? t("conventions.restDay")}
              </Text>
            </View>
          </SurfaceCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}
