import { useCallback, useLayoutEffect } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { DataBoundary } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import { BuildDetailBody } from "@/screens/build-detail/DetailBody";

type BuildRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
  progress: number;
  workflowProgressPercent: number;
};

type SummaryPayload =
  | {
      progressPercent: number;
      tasksChecked: number;
      tasksTotal: number;
      linkedItemCount: number;
      linkedItemsCompleteCount: number;
      remainingDays: number | null;
      budgetDifferenceCents: number | null;
    }
  | null
  | undefined;

type DetailLoaded = {
  buildId: Id<"builds">;
  userId: string;
  build: BuildRow;
  heroUri: string | null;
  summary: SummaryPayload;
};

export default function BuildDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const duplicateBuild = useMutation(api.builds.duplicate);
  const removeBuild = useMutation(api.builds.remove);
  const raw = useLocalSearchParams<{ buildId: string | string[] }>().buildId;
  const buildIdParam = Array.isArray(raw) ? raw[0] : raw;
  const id = buildIdParam ? (buildIdParam as Id<"builds">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const build = useQuery(api.builds.get, id ? { id } : "skip");
  const heroStorageUrl = useQuery(
    api.files.getUrl,
    build?.imageStorageId ? { storageId: build.imageStorageId } : "skip"
  );
  const summary = useQuery(api.builds.getSummary, id && userId ? { buildId: id, userId } : "skip");
  const outlineNodes = useQuery(
    api.cosplayNodes.listBuildVisualNodes,
    id ? { buildId: id } : "skip"
  );
  const refImages = useQuery(api.buildReferenceImages.listByBuild, id ? { buildId: id } : "skip");
  const processPics = useQuery(api.buildProcessPictures.listByBuild, id ? { buildId: id } : "skip");

  const collaborators = useQuery(
    api.buildCollaborators.listByBuild,
    id && build && userId && build.userId === userId ? { buildId: id, userId } : "skip"
  );

  const loading =
    identity === undefined ||
    (id != null && build === undefined) ||
    (build != null && build.imageStorageId != null && heroStorageUrl === undefined) ||
    (id != null &&
      build != null &&
      userId != null &&
      build.userId === userId &&
      collaborators === undefined);

  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!id || build === null) status = "empty";
  else if (!userId) status = "empty";
  else status = "ready";

  const heroUri: string | null =
    build?.imageUrl ?? (build?.imageStorageId ? (heroStorageUrl ?? null) : null) ?? null;

  const data: DetailLoaded | undefined =
    status === "ready" && build && userId && id
      ? { buildId: id, userId, build, heroUri, summary }
      : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: build?.name ?? t("common.builds"),
      headerRight: undefined,
    });
  }, [build, navigation, t]);

  const handleDuplicate = useCallback(() => {
    if (!userId || !build) return;
    void (async () => {
      try {
        const newId = await duplicateBuild({
          userId,
          sourceBuildId: build._id,
        });
        router.replace(APP_HREF.build(newId as string));
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    })();
  }, [build, duplicateBuild, router, t, userId]);

  const handleDelete = useCallback(() => {
    if (!userId || !build) return;
    Alert.alert(t("buildDetail.deleteBuildTitle"), t("buildDetail.deleteBuildBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("buildDetail.deleteBuildAction"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await removeBuild({ id: build._id, userId });
              router.replace("/(app)/(tabs)/builds");
            } catch (e) {
              Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
            }
          })();
        },
      },
    ]);
  }, [build, removeBuild, router, t, userId]);

  return (
    <DataBoundary<DetailLoaded>
      status={status}
      data={data}
      error={error}
      empty={
        <View className="flex-1 justify-center bg-kyar-bg px-6 dark:bg-kyar-dark-bg">
          <Text className="text-center text-kyar-meta dark:text-kyar-dark-meta">
            {t("builds.notFound")}
          </Text>
        </View>
      }
    >
      {(loaded) => (
        <BuildDetailBody
          buildId={loaded.buildId}
          userId={loaded.userId}
          build={loaded.build}
          heroUri={loaded.heroUri}
          summary={loaded.summary}
          outlineNodes={outlineNodes}
          refImages={refImages}
          processPics={processPics}
          collaborators={loaded.build.userId === loaded.userId ? (collaborators ?? []) : undefined}
          onDuplicate={loaded.build.userId === loaded.userId ? handleDuplicate : undefined}
          onDelete={loaded.build.userId === loaded.userId ? handleDelete : undefined}
        />
      )}
    </DataBoundary>
  );
}
