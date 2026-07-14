import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { MobilePageHeader } from "@/components/navigation/MobilePageHeader";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { DataBoundary, MetaLabel, SurfaceCard } from "@/ui";
import {
  BUILD_WORKFLOW_GROUP_KEY,
  flattenWorkflowWithElementGroup,
  sortWorkflowGroupKeys,
  type WorkflowTreeNodeShape,
} from "@/screens/build-detail/buildWorkflowTreeHelpers";

type PublicBuild = {
  _id: Id<"builds">;
  name: string;
  character?: string | null;
  status: string;
  notes?: string | null;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  imageFocalX?: number | null;
  imageFocalY?: number | null;
  tasksTotal?: number;
  tasksChecked?: number;
};

type PublicViewerToggles = {
  showExplorer: boolean;
  showTasks: boolean;
  showVisualBoard: boolean;
  showSummary: boolean;
  showCollaborators: boolean;
  showNotes: boolean;
};

type VisualNode = {
  _id: Id<"cosplayNodes">;
  name: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  nodeType?: string;
  progressPercent: number;
  childCount?: number;
  hasIncompleteDescendants?: boolean;
  isRoot: boolean;
  depth: number;
  sortOrder?: number;
};

type SummaryPayload = {
  progressPercent: number;
  tasksChecked: number;
  tasksTotal: number;
  linkedItemCount: number;
  linkedItemsCompleteCount: number;
  remainingDays: number | null;
  budgetDifferenceCents: number | null;
} | null;

type CollaboratorRow = {
  collaboratorId: Id<"buildCollaborators">;
  role: string;
  username: string | null;
  displayLabel: string;
};

type PublicViewerBundle = {
  build: PublicBuild;
  togglesResolved: PublicViewerToggles;
  visualNodes: VisualNode[];
  summary: SummaryPayload;
  referenceImages: {
    _id: Id<"buildReferenceImages">;
    imageStorageId?: Id<"_storage"> | null;
    imageUrl?: string | null;
  }[];
  processPictures: {
    _id: Id<"buildProcessPictures">;
    imageStorageId?: Id<"_storage"> | null;
    imageUrl?: string | null;
  }[];
  collaborators: CollaboratorRow[];
};

type WorkflowTreeData = {
  items: WorkflowTreeNodeShape[];
  stats?: {
    tasksTotal: number;
    tasksDone: number;
    workflowProgressPercent: number;
  };
} | null;

type Props = {
  buildId: Id<"builds"> | undefined;
  shareToken?: string;
};

type TabId = "explorer" | "tasks" | "board" | "summary";

function formatBudgetDelta(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    signDisplay: "always",
  }).format(cents / 100);
}

function PublicBuildHero({ build }: { build: PublicBuild }) {
  const storageUrl = useQuery(
    api.files.getUrl,
    !build.imageUrl && build.imageStorageId ? { storageId: build.imageStorageId } : "skip"
  );
  const resolvedUri = build.imageUrl ?? storageUrl ?? null;

  if (!build.imageUrl && build.imageStorageId && storageUrl === undefined) {
    return (
      <View className="aspect-[21/9] items-center justify-center bg-kyar-muted dark:bg-kyar-dark-muted">
        <ActivityIndicator />
      </View>
    );
  }

  if (!resolvedUri) {
    return (
      <View className="aspect-[21/9] items-center justify-center bg-kyar-muted dark:bg-kyar-dark-muted">
        <Text className="text-5xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">◇</Text>
      </View>
    );
  }

  return (
    <FocalCoverImage
      uri={resolvedUri}
      focalX={build.imageFocalX}
      focalY={build.imageFocalY}
      className="aspect-[21/9] w-full"
      accessibilityLabel={build.name}
    />
  );
}

function PublicMediaRail({
  title,
  items,
}: {
  title: string;
  items: { _id: string; imageStorageId?: Id<"_storage"> | null; imageUrl?: string | null }[];
}) {
  if (!items.length) return null;

  return (
    <SurfaceCard className="px-4 py-4">
      <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
        <View className="flex-row gap-3">
          {items.map((item) => (
            <View
              key={item._id}
              className="h-36 w-28 overflow-hidden rounded-2xl bg-kyar-muted dark:bg-kyar-dark-muted"
            >
              <PublicMediaImage imageStorageId={item.imageStorageId} imageUrl={item.imageUrl} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SurfaceCard>
  );
}

function PublicMediaImage({
  imageStorageId,
  imageUrl,
}: {
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
}) {
  const storageUrl = useQuery(
    api.files.getUrl,
    !imageUrl && imageStorageId ? { storageId: imageStorageId } : "skip"
  );
  const resolvedUri = imageUrl ?? storageUrl ?? null;

  if (!imageUrl && imageStorageId && storageUrl === undefined) {
    return (
      <View className="h-full w-full items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!resolvedUri) {
    return <View className="h-full w-full bg-kyar-muted dark:bg-kyar-dark-muted" />;
  }

  return <FocalCoverImage uri={resolvedUri} className="h-full w-full" />;
}

export function PublicBuildDetailScreen({ buildId, shareToken }: Props) {
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const currentUserId = identity?.subject ?? null;
  const bundleArgs = buildId ? { buildId } : shareToken ? { shareToken } : "skip";
  const bundle = useQuery(api.builds.getPublicViewerBundle, bundleArgs) as
    | PublicViewerBundle
    | null
    | undefined;
  const buildIdForTree = bundle?.build._id;
  const shareTokenForQueries = shareToken?.trim() ? shareToken : undefined;
  const workflowTree = useQuery(
    api.workflow.listBuildTree,
    buildIdForTree && bundle?.togglesResolved.showTasks
      ? shareTokenForQueries
        ? { buildId: buildIdForTree, shareToken: shareTokenForQueries }
        : { buildId: buildIdForTree }
      : "skip"
  ) as WorkflowTreeData | undefined;

  const status =
    (buildId == null && !shareTokenForQueries) || bundle === null
      ? "empty"
      : bundle === undefined ||
          identity === undefined ||
          (bundle.togglesResolved.showTasks && workflowTree === undefined)
        ? "loading"
        : "ready";

  return (
    <>
      <Stack.Screen
        options={{
          title: bundle?.build.name ?? t("publicBuild.title"),
          headerLargeTitle: false,
        }}
      />
      <MobilePageHeader
        eyebrow={t("publicBuild.title")}
        title={bundle?.build.name ?? t("publicBuild.title")}
        subtitle={bundle?.build.character ?? undefined}
        fallbackHref={APP_HREF.home}
        containerClassName="px-4 pt-4"
      />
      <DataBoundary
        status={status}
        data={bundle ?? undefined}
        empty={
          <View className="flex-1 justify-center bg-kyar-bg px-6 dark:bg-kyar-dark-bg">
            <Text className="text-center text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("publicBuild.notFound")}
            </Text>
          </View>
        }
      >
        {(loadedBundle) => (
          <PublicBuildDetailBody
            bundle={loadedBundle}
            workflowTree={workflowTree ?? null}
            currentUserId={currentUserId}
            shareToken={shareTokenForQueries}
          />
        )}
      </DataBoundary>
    </>
  );
}

function PublicBuildDetailBody({
  bundle,
  workflowTree,
  currentUserId,
  shareToken,
}: {
  bundle: PublicViewerBundle;
  workflowTree: WorkflowTreeData;
  currentUserId: string | null;
  shareToken?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const build = bundle.build;
  const toggles = bundle.togglesResolved;
  const likeCount = useQuery(
    api.buildLikes.countByBuild,
    shareToken ? { buildId: build._id, shareToken } : { buildId: build._id }
  );
  const comments =
    useQuery(
      api.buildComments.listByBuild,
      shareToken ? { buildId: build._id, shareToken } : { buildId: build._id }
    ) ?? [];
  const isLiked = useQuery(
    api.buildLikes.isLikedBy,
    currentUserId ? { userId: currentUserId, buildId: build._id } : "skip"
  );
  const likeBuild = useMutation(api.buildLikes.like);
  const unlikeBuild = useMutation(api.buildLikes.unlike);
  const addComment = useMutation(api.buildComments.add);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);

  const visibleTabs = useMemo(() => {
    const tabs: TabId[] = [];
    if (toggles.showExplorer) tabs.push("explorer");
    if (toggles.showTasks) tabs.push("tasks");
    if (toggles.showVisualBoard) tabs.push("board");
    if (toggles.showSummary || toggles.showCollaborators) tabs.push("summary");
    return tabs;
  }, [toggles]);

  const [tab, setTab] = useState<TabId>(visibleTabs[0] ?? "explorer");

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.includes(tab)) {
      setTab(visibleTabs[0]);
    }
  }, [tab, visibleTabs]);

  const visualById = useMemo(() => {
    const next = new Map<
      string,
      { sortOrder: number; depth: number; name: string; nodeType: string }
    >();
    for (const node of bundle.visualNodes) {
      next.set(node._id as string, {
        sortOrder: node.sortOrder ?? 0,
        depth: node.depth,
        name: node.name,
        nodeType: node.nodeType ?? "element",
      });
    }
    return next;
  }, [bundle.visualNodes]);

  const workflowRows = useMemo(
    () => flattenWorkflowWithElementGroup((workflowTree?.items ?? []) as WorkflowTreeNodeShape[]),
    [workflowTree?.items]
  );

  const workflowGrouped = useMemo(() => {
    const grouped = new Map<string, typeof workflowRows>();
    for (const row of workflowRows) {
      const list = grouped.get(row.elementGroupKey) ?? [];
      list.push(row);
      grouped.set(row.elementGroupKey, list);
    }
    return {
      grouped,
      sortedKeys: sortWorkflowGroupKeys(Array.from(grouped.keys()), visualById),
    };
  }, [visualById, workflowRows]);

  const summaryMetrics = useMemo(() => {
    const summary = bundle.summary;
    if (!summary) return [];
    return [
      {
        key: "progress",
        label: t("buildDetail.summaryProgress", { pct: Math.round(summary.progressPercent) }),
      },
      {
        key: "tasks",
        label: t("buildDetail.summaryTasks", {
          checked: summary.tasksChecked,
          total: summary.tasksTotal,
        }),
      },
      {
        key: "linked",
        label: t("buildDetail.summaryLinked", {
          done: summary.linkedItemsCompleteCount,
          total: summary.linkedItemCount,
        }),
      },
      ...(summary.remainingDays != null
        ? [
            {
              key: "due",
              label: t("buildDetail.summaryDue", { days: summary.remainingDays }),
            },
          ]
        : []),
      ...(summary.budgetDifferenceCents != null
        ? [
            {
              key: "budget",
              label: t("publicBuild.summaryBudget", {
                value: formatBudgetDelta(summary.budgetDifferenceCents),
              }),
            },
          ]
        : []),
    ];
  }, [bundle.summary, t]);

  const outlineNodes = useMemo(
    () =>
      [...bundle.visualNodes].sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.name.localeCompare(b.name);
      }),
    [bundle.visualNodes]
  );

  const handleToggleLike = async () => {
    if (!currentUserId) return;
    try {
      if (isLiked) {
        await unlikeBuild({ userId: currentUserId, buildId: build._id });
        return;
      }
      await likeBuild({ userId: currentUserId, buildId: build._id });
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  };

  const handleAddComment = async () => {
    const body = commentBody.trim();
    if (!currentUserId || !body || commentPending) return;
    setCommentPending(true);
    try {
      await addComment({ userId: currentUserId, buildId: build._id, body });
      setCommentBody("");
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setCommentPending(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerClassName="gap-4 px-4 pb-16 pt-4"
    >
      <SurfaceCard className="overflow-hidden px-0 py-0">
        <PublicBuildHero build={build} />
        <View className="gap-3 px-4 py-4">
          {build.character ? <MetaLabel>{build.character}</MetaLabel> : null}
          <View className="flex-row flex-wrap items-center gap-3">
            <Text className="text-xs uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {build.status}
            </Text>
            {(build.tasksTotal ?? 0) > 0 ? (
              <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("buildDetail.summaryTasks", {
                  checked: build.tasksChecked ?? 0,
                  total: build.tasksTotal ?? 0,
                })}
              </Text>
            ) : null}
          </View>
          <View className="flex-row flex-wrap items-center gap-3 border-t border-kyar-borderSubtle pt-3 dark:border-kyar-dark-borderSubtle">
            <Pressable
              onPress={() => void handleToggleLike()}
              disabled={!currentUserId}
              className="flex-row items-center gap-2 rounded-full border border-kyar-borderSubtle px-3 py-2 active:opacity-80 disabled:opacity-50 dark:border-kyar-dark-borderSubtle"
            >
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={16}
                color={isLiked ? colors.danger : colors.meta}
              />
              <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
                {likeCount ?? 0}
              </Text>
            </Pressable>
            <View className="flex-row items-center gap-2 rounded-full border border-kyar-borderSubtle px-3 py-2 dark:border-kyar-dark-borderSubtle">
              <Ionicons name="chatbubble-outline" size={16} color={colors.meta} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
                {comments.length}
              </Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      {visibleTabs.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {visibleTabs.map((value) => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              className={`rounded-full border px-4 py-2 ${
                tab === value
                  ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                  : "border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle"
              }`}
            >
              <Text
                className={`text-[10px] font-semibold uppercase tracking-widest ${
                  tab === value
                    ? "text-kyar-bg dark:text-kyar-dark-bg"
                    : "text-kyar-text dark:text-kyar-dark-text"
                }`}
              >
                {value === "explorer"
                  ? t("buildDetail.tabExplorer")
                  : value === "tasks"
                    ? t("buildDetail.tabTasks")
                    : value === "board"
                      ? t("buildDetail.tabBoard")
                      : t("buildDetail.tabSummary")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === "explorer" && toggles.showExplorer ? (
        <View className="gap-4">
          {toggles.showNotes && build.notes ? (
            <SurfaceCard className="px-4 py-4">
              <MetaLabel>{t("buildDetail.notesLabel")}</MetaLabel>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {build.notes}
              </Text>
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="px-4 py-4">
            <MetaLabel>{t("buildDetail.subElements")}</MetaLabel>
            {outlineNodes.length === 0 ? (
              <Text className="mt-3 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("publicBuild.explorerEmpty")}
              </Text>
            ) : (
              <View className="mt-4 gap-2">
                {outlineNodes.map((node) => (
                  <View
                    key={node._id as string}
                    className="rounded-2xl bg-kyar-panel px-4 py-3 dark:bg-kyar-dark-panel"
                    style={{ marginLeft: Math.min(node.depth, 8) * 10 }}
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                        {node.nodeType === "material"
                          ? t("elements.typeMaterial")
                          : t("elements.typeElement")}
                      </Text>
                      <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                        {node.name}
                      </Text>
                    </View>
                    <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("elements.progressPercent", { pct: Math.round(node.progressPercent) })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </SurfaceCard>
        </View>
      ) : null}

      {tab === "tasks" && toggles.showTasks ? (
        <View className="gap-4">
          {workflowRows.length === 0 ? (
            <SurfaceCard className="px-4 py-5">
              <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("publicBuild.tasksEmpty")}
              </Text>
            </SurfaceCard>
          ) : (
            workflowGrouped.sortedKeys.map((groupKey) => {
              const rows = workflowGrouped.grouped.get(groupKey);
              if (!rows?.length) return null;

              const isBuildGroup = groupKey === BUILD_WORKFLOW_GROUP_KEY;
              const meta = !isBuildGroup ? visualById.get(groupKey) : null;

              return (
                <SurfaceCard key={groupKey} className="px-0 py-0">
                  <View
                    className="border-b border-kyar-borderSubtle bg-kyar-panel px-4 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                    style={{ paddingLeft: 16 + (meta?.depth ?? 0) * 10 }}
                  >
                    <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                      {isBuildGroup
                        ? t("buildDetail.buildWideSteps")
                        : (meta?.name ?? t("common.elements"))}
                    </Text>
                  </View>
                  <View className="gap-2 px-3 py-3">
                    {rows.map((row) => (
                      <View
                        key={row._id as string}
                        className="rounded-2xl bg-kyar-panel px-4 py-3 dark:bg-kyar-dark-panel"
                        style={{ marginLeft: row.depth * 12 }}
                      >
                        <View className="flex-row items-start gap-3">
                          <View
                            className="mt-0.5 h-7 w-7 items-center justify-center rounded-full border"
                            style={{
                              borderColor:
                                row.status === "done" ? colors.accent : colors.borderSubtle,
                              backgroundColor:
                                row.status === "done" ? colors.accent : "transparent",
                            }}
                          >
                            {row.status === "done" ? (
                              <Ionicons name="checkmark" size={16} color={colors.bg} />
                            ) : null}
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              className={`text-sm ${
                                row.status === "done"
                                  ? "text-kyar-textTertiary line-through dark:text-kyar-dark-textTertiary"
                                  : "text-kyar-text dark:text-kyar-dark-text"
                              }`}
                            >
                              {row.title}
                            </Text>
                            <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                              {row.dueDate
                                ? t("publicBuild.taskDue", { date: row.dueDate })
                                : t("elements.progressPercent", {
                                    pct: Math.round(row.progressPercent),
                                  })}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </SurfaceCard>
              );
            })
          )}
        </View>
      ) : null}

      {tab === "board" && toggles.showVisualBoard ? (
        <View className="gap-4">
          <PublicMediaRail
            title={t("buildDetail.referenceImages")}
            items={bundle.referenceImages}
          />
          <PublicMediaRail
            title={t("buildDetail.processPictures")}
            items={bundle.processPictures}
          />
          <SurfaceCard className="px-4 py-4">
            <MetaLabel>{t("buildDetail.tabBoard")}</MetaLabel>
            {bundle.visualNodes.length === 0 ? (
              <Text className="mt-3 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("buildDetail.boardEmpty")}
              </Text>
            ) : (
              <View className="mt-4 flex-row flex-wrap gap-3">
                {bundle.visualNodes.map((node) => (
                  <View
                    key={node._id as string}
                    className="w-[48%] overflow-hidden rounded-3xl bg-kyar-panel dark:bg-kyar-dark-panel"
                  >
                    <View className="aspect-square w-full bg-kyar-muted dark:bg-kyar-dark-muted">
                      <PublicMediaImage
                        imageStorageId={node.imageStorageId}
                        imageUrl={node.imageUrl}
                      />
                    </View>
                    <View className="gap-1 px-3 py-3">
                      <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                        {node.name}
                      </Text>
                      <Text className="text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("elements.progressPercent", { pct: Math.round(node.progressPercent) })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </SurfaceCard>
        </View>
      ) : null}

      {tab === "summary" && (toggles.showSummary || toggles.showCollaborators) ? (
        <View className="gap-4">
          {summaryMetrics.length > 0 ? (
            <SurfaceCard className="px-4 py-4">
              <View className="flex-row flex-wrap gap-3">
                {summaryMetrics.map((item) => (
                  <View
                    key={item.key}
                    className="min-w-[46%] flex-1 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel"
                  >
                    <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          ) : null}

          {toggles.showCollaborators ? (
            <SurfaceCard className="px-4 py-4">
              <MetaLabel>{t("buildDetail.collaborators")}</MetaLabel>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                className="mt-2 text-[30px] italic text-kyar-text dark:text-kyar-dark-text"
              >
                {t("publicBuild.teamTitle")}
              </Text>
              {bundle.collaborators.length === 0 ? (
                <Text className="mt-4 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("publicBuild.collaboratorsEmpty")}
                </Text>
              ) : (
                <View className="mt-4 gap-3">
                  {bundle.collaborators.map((collaborator) => (
                    <View
                      key={collaborator.collaboratorId as string}
                      className="rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel"
                    >
                      <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
                        {collaborator.displayLabel}
                      </Text>
                      <Text className="mt-1 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                        {collaborator.role === "editor"
                          ? t("buildDetail.roleEditor")
                          : collaborator.role === "viewer"
                            ? t("buildDetail.roleViewer")
                            : collaborator.role}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </SurfaceCard>
          ) : null}
        </View>
      ) : null}

      <SurfaceCard className="px-4 py-4">
        <MetaLabel>{t("social.commentsTitle")}</MetaLabel>
        {comments.length === 0 ? (
          <Text className="mt-3 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("social.commentsEmpty")}
          </Text>
        ) : (
          <View className="mt-4 gap-3">
            {comments.map((comment) => (
              <View
                key={comment._id}
                className="rounded-2xl bg-kyar-panel px-4 py-3 dark:bg-kyar-dark-panel"
              >
                <Text className="text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                  {comment.authorUsername ? `@${comment.authorUsername}` : comment.authorName}
                </Text>
                <Text className="mt-2 text-sm leading-6 text-kyar-text dark:text-kyar-dark-text">
                  {comment.body}
                </Text>
                <Text className="mt-2 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {new Date(comment.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {currentUserId ? (
          <>
            <TextInput
              value={commentBody}
              onChangeText={setCommentBody}
              placeholder={t("social.commentPlaceholder")}
              className="mt-4 min-h-[104px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              multiline
              textAlignVertical="top"
            />
            <Pressable
              onPress={() => void handleAddComment()}
              disabled={!commentBody.trim() || commentPending}
              className="mt-4 items-center rounded-full bg-kyar-text px-4 py-3 disabled:opacity-40 dark:bg-kyar-dark-text"
            >
              <Text className="text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                {commentPending ? t("social.commentPosting") : t("social.commentAction")}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text className="mt-4 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("social.commentsSignIn")}
          </Text>
        )}
      </SurfaceCard>
    </ScrollView>
  );
}
