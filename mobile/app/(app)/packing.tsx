import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { APP_HREF } from "@/lib/appRoutes";
import { useOfflineQuery } from "@/offline";
import {
  countPackingProgress,
  countPlannedBuilds,
  formatDateRange,
  type ConventionWithDetails,
} from "@/screens/conventions/utils";
import { DataBoundary, MetaLabel, SurfaceCard } from "@/ui";

type Ready = { conventions: ConventionWithDetails[] };

export default function PackingOverviewScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const conventions = useOfflineQuery(
    api.conventions.listWithDetails,
    userId ? { userId } : "skip"
  );

  const loading = identity === undefined || (userId != null && conventions === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || (conventions ?? []).length === 0) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready"
      ? { conventions: (conventions ?? []) as ConventionWithDetails[] }
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t("conventions.crossPackingTitle"), headerShown: true }} />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <PackingOverviewBody conventions={loaded.conventions} />}
      </DataBoundary>
    </>
  );
}

function PackingOverviewBody({ conventions }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const activeConventions = conventions.filter((convention) => convention.archived !== true);

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 }}
    >
      <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {t("conventions.crossPackingSubtitle")}
      </Text>

      {activeConventions.map((convention) => {
        const progress = countPackingProgress(convention.packing);
        const plannedBuilds = countPlannedBuilds(convention.plans);
        return (
          <Pressable
            key={convention._id}
            onPress={() => router.push(APP_HREF.conventionPacking(convention._id))}
            className="active:opacity-90"
          >
            <SurfaceCard className="px-4 py-4">
              <MetaLabel>{formatDateRange(convention.startDate, convention.endDate)}</MetaLabel>
              <Text className="mt-2 text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">
                {convention.name}
              </Text>
              <Text className="mt-2 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {convention.location ?? t("conventions.noLocation")}
              </Text>
              <View className="mt-4 flex-row gap-3">
                <MiniStat label={t("conventions.metricBuilds")} value={plannedBuilds} />
                <MiniStat
                  label={t("conventions.metricPacking")}
                  value={`${progress.checked}/${progress.total}`}
                />
              </View>
            </SurfaceCard>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 rounded-2xl bg-kyar-panel px-3 py-3 dark:bg-kyar-dark-panel">
      <MetaLabel>{label}</MetaLabel>
      <Text className="mt-2 text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
        {value}
      </Text>
    </View>
  );
}
