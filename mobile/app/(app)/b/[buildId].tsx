import { useCallback, useLayoutEffect } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import type { Doc, Id } from "convex/_generated/dataModel";
import { glass } from "@kyarafit/design-system/rn";
import { DataBoundary } from "@/ui";
import { PhotoBackdrop } from "@/ui/glass";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { BuildDetailBody } from "@/screens/build-detail/DetailBody";
import { PublicBuildDetailScreen } from "@/screens/public-build/PublicBuildDetailScreen";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useLocalId, useOnlineId } from "@/vault/hooks";

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
  const duplicateBuild = useOfflineMutation(api.builds.duplicate);
  const removeBuild = useOfflineMutation(api.builds.remove);
  const params = useLocalSearchParams<{ buildId: string | string[]; tab?: string | string[] }>();
  const raw = params.buildId;
  const buildIdParam = Array.isArray(raw) ? raw[0] : raw;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab =
    rawTab === "summary" ||
    rawTab === "explorer" ||
    rawTab === "tasks" ||
    rawTab === "board" ||
    rawTab === "updates"
      ? rawTab
      : undefined;
  const id = useLocalId(buildIdParam ? (buildIdParam as Id<"builds">) : undefined);

  const onlineId = useOnlineId(id);
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const build = useOfflineQuery(api.builds.get, id ? { id } : "skip");
  const heroStorageUrl = useQuery(
    api.files.getUrl,
    build?.imageStorageId ? { storageId: build.imageStorageId } : "skip"
  );
  const summary = useOfflineQuery(
    api.builds.getSummary,
    id && userId ? { buildId: id, userId } : "skip"
  );
  const outlineNodes = useOfflineQuery(
    api.cosplayNodes.listBuildVisualNodes,
    id ? { buildId: id } : "skip"
  );
  const refImages = useOfflineQuery(
    api.buildReferenceImages.listByBuild,
    id ? { buildId: id } : "skip"
  );
  const processPics = useOfflineQuery(
    api.buildProcessPictures.listByBuild,
    id ? { buildId: id } : "skip"
  );

  const collaborators = useQuery(
    api.buildCollaborators.listByBuild,
    onlineId && build && userId && build.userId === userId ? { buildId: onlineId, userId } : "skip"
  );

  // Only the local build gates the screen. Collaborators and cloud-hosted hero photos are online
  // extras that fill in when a connection is available.
  const loading = identity === undefined || (id != null && build === undefined);

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
              router.replace(APP_HREF.builds);
            } catch (e) {
              Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
            }
          })();
        },
      },
    ]);
  }, [build, removeBuild, router, t, userId]);

  // Builds that are not in this device's vault (shared by a collaborator or a group) live online:
  // show them read-only through the online viewer rather than as "not found".
  if (onlineId != null && identity != null && build === null) {
    return (
      <View style={{ flex: 1 }}>
        <PublicBuildDetailScreen buildId={onlineId} />
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 24 }}>
          <OfflineBanner />
        </View>
      </View>
    );
  }

  return (
    <DataBoundary<DetailLoaded>
      status={status}
      data={data}
      error={error}
      empty={
        <View style={{ flex: 1 }}>
          <PhotoBackdrop scrim="off" kenBurns={false} />
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
            <Text
              style={{
                textAlign: "center",
                fontFamily: APP_FONT_FAMILIES.sansRegular,
                fontSize: 13,
                color: glass.text.fg70,
              }}
            >
              {t("builds.notFound")}
            </Text>
          </View>
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
          collaborators={
            onlineId && loaded.build.userId === loaded.userId ? (collaborators ?? []) : undefined
          }
          onDuplicate={loaded.build.userId === loaded.userId ? handleDuplicate : undefined}
          onDelete={loaded.build.userId === loaded.userId ? handleDelete : undefined}
          initialTab={initialTab}
        />
      )}
    </DataBoundary>
  );
}
