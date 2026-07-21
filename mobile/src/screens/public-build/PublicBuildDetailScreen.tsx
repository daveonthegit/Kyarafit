import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassPanel, PhotoBackdrop } from "@/ui/glass";
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

/* ── Glass presentation atoms private to this viewer screen (8c) ─────────── */

type GlassTone = "fg" | "fg70" | "fg55" | "fg45" | "ink";

const TONE_COLOR: Record<GlassTone, string> = {
  fg: glass.text.fg,
  fg70: glass.text.fg70,
  fg55: glass.text.fg55,
  fg45: glass.text.fg45,
  ink: glass.text.ink,
};

function ViewerMeta({
  children,
  size = 9,
  tone = "fg55",
  tracking = 0.16,
  bold = false,
  numberOfLines,
  style,
}: {
  children: ReactNode;
  size?: number;
  tone?: GlassTone;
  tracking?: number;
  bold?: boolean;
  numberOfLines?: number;
  style?: object;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: bold ? APP_FONT_FAMILIES.sansBold : APP_FONT_FAMILIES.sansMedium,
          fontSize: size,
          letterSpacing: ls(tracking, size),
          textTransform: "uppercase",
          color: TONE_COLOR[tone],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function ViewerBody({
  children,
  size = 13,
  tone = "fg70",
  semiBold = false,
  numberOfLines,
  strike = false,
  style,
}: {
  children: ReactNode;
  size?: number;
  tone?: GlassTone;
  semiBold?: boolean;
  numberOfLines?: number;
  strike?: boolean;
  style?: object;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: semiBold ? APP_FONT_FAMILIES.sansSemiBold : APP_FONT_FAMILIES.sansRegular,
          fontSize: size,
          lineHeight: Math.round(size * 1.45),
          color: TONE_COLOR[tone],
          textDecorationLine: strike ? "line-through" : "none",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** 2px progress hairline: divider track, light fill. */
function ViewerHairlineProgress({ percent, style }: { percent: number; style?: object }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View
      style={[
        { height: 2, borderRadius: 1, backgroundColor: glass.border.divider, overflow: "hidden" },
        style,
      ]}
    >
      <View
        style={{
          height: 2,
          width: `${clamped}%`,
          borderRadius: 1,
          backgroundColor: glass.text.fg,
        }}
      />
    </View>
  );
}

const FIELD_BOX = {
  borderRadius: 10,
  borderWidth: borderWidth.hairline,
  borderColor: glass.border.divider,
  backgroundColor: glass.surface.field,
} as const;

const OUTLINE_PILL = {
  minHeight: 44,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: glass.border.strong,
  backgroundColor: glass.surface.bar,
  paddingHorizontal: 18,
};

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={glass.text.fg70} />
      </View>
    );
  }

  if (!resolvedUri) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="image-outline" size={20} color={glass.text.fg45} />
      </View>
    );
  }

  return <FocalCoverImage uri={resolvedUri} className="h-full w-full" />;
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
    <View>
      <ViewerMeta size={10} tone="fg70" bold>
        {title}
      </ViewerMeta>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {items.map((item) => (
            <View
              key={item._id}
              style={{
                height: 128,
                width: 100,
                borderRadius: 12,
                overflow: "hidden",
                borderWidth: borderWidth.hairline,
                borderColor: glass.border.divider,
                backgroundColor: glass.surface.field,
              }}
            >
              <PublicMediaImage imageStorageId={item.imageStorageId} imageUrl={item.imageUrl} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function PublicBuildDetailScreen({ buildId, shareToken }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: bundle?.build.name ?? t("publicBuild.title"),
          headerLargeTitle: false,
        }}
      />
      <PhotoBackdrop
        imageStorageId={bundle?.build.imageStorageId}
        imageUrl={bundle?.build.imageUrl}
        focalX={bundle?.build.imageFocalX}
        focalY={bundle?.build.imageFocalY}
      />

      {/* Viewer bar (8c): back affordance + eyebrow, no edit chrome. */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <MobileBackButton surface="glass" fallbackHref={APP_HREF.home} />
        <ViewerMeta size={10} tone="fg70" bold tracking={0.2} numberOfLines={1} style={{ flex: 1 }}>
          {bundle?.build.name
            ? `${t("publicBuild.title")} ▸ ${bundle.build.name}`
            : t("publicBuild.title")}
        </ViewerMeta>
      </View>

      <DataBoundary
        status={status}
        data={bundle ?? undefined}
        empty={
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
            <ViewerBody size={13} tone="fg70" style={{ textAlign: "center" }}>
              {t("publicBuild.notFound")}
            </ViewerBody>
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
    </View>
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
  const insets = useSafeAreaInsets();
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

  /** Board tab: 2-col mini masonry columns (no FlatList — real flex widths, pitfall 5). */
  const boardColumns = useMemo(() => {
    const left: VisualNode[] = [];
    const right: VisualNode[] = [];
    bundle.visualNodes.forEach((node, index) => {
      if (index % 2 === 0) left.push(node);
      else right.push(node);
    });
    return [left, right] as const;
  }, [bundle.visualNodes]);

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

  const tasksTotal = build.tasksTotal ?? 0;
  const tasksChecked = build.tasksChecked ?? 0;
  const progressPct = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

  const eyebrow = [build.character, build.status].filter(Boolean).join(" · ") || build.status;

  return (
    <View style={{ flex: 1 }}>
      {/* Headline block (8c) */}
      <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14 }}>
        <ViewerMeta size={9} tone="fg70" bold tracking={0.26}>
          {eyebrow}
        </ViewerMeta>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 6,
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontStyle: "italic",
            fontSize: 38,
            lineHeight: 42,
            color: glass.text.fg,
          }}
        >
          {build.name}
        </Text>
        {tasksTotal > 0 ? (
          <>
            <ViewerHairlineProgress percent={progressPct} style={{ marginTop: 12 }} />
            <ViewerMeta size={9} tone="fg55" style={{ marginTop: 6 }}>
              {t("buildDetail.headlineTasksMeta", {
                defaultValue: "{{checked}} / {{total}} tasks · {{pct}}%",
                checked: tasksChecked,
                total: tasksTotal,
                pct: progressPct,
              })}
            </ViewerMeta>
          </>
        ) : null}

        {/* Social actions: glass-outline pills (favorite + comment counts) */}
        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => void handleToggleLike()}
            disabled={!currentUserId}
            accessibilityRole="button"
            accessibilityLabel={t("social.likeAction", { defaultValue: "Like" })}
            className="active:opacity-80"
            style={[OUTLINE_PILL, !currentUserId && { opacity: 0.5 }]}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={15}
              color={isLiked ? glass.text.danger : glass.text.fg}
            />
            <ViewerMeta size={10} tone="fg" bold>
              {likeCount ?? 0}
            </ViewerMeta>
          </Pressable>
          <View style={OUTLINE_PILL}>
            <Ionicons name="chatbubble-outline" size={15} color={glass.text.fg} />
            <ViewerMeta size={10} tone="fg" bold>
              {comments.length}
            </ViewerMeta>
          </View>
        </View>
      </View>

      {/* ONE glass work panel: owner-enabled tabs + comments (8c) */}
      <View
        style={{
          minHeight: 0,
          flex: 1,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <GlassPanel style={{ flex: 1 }}>
          <View
            style={{
              borderBottomWidth: borderWidth.hairline,
              borderBottomColor: glass.border.divider,
            }}
          >
            {/* Online-only surface: offline strip lives in the panel header. */}
            <OfflineBanner />
            {visibleTabs.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 20,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 0,
                  }}
                >
                  {visibleTabs.map((value) => {
                    const active = tab === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setTab(value)}
                        accessibilityRole="button"
                        className="active:opacity-80"
                        style={{
                          minHeight: 44,
                          justifyContent: "center",
                          borderBottomWidth: 1.5,
                          borderBottomColor: active ? glass.text.fg : "transparent",
                        }}
                      >
                        <ViewerMeta size={10} tone={active ? "fg" : "fg55"} bold={active} tracking={0.18}>
                          {value === "explorer"
                            ? t("buildDetail.tabExplorer")
                            : value === "tasks"
                              ? t("buildDetail.tabTasks")
                              : value === "board"
                                ? t("buildDetail.tabBoard")
                                : t("buildDetail.tabSummary")}
                        </ViewerMeta>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : null}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, paddingBottom: 24, gap: 18 }}
          >
            {tab === "explorer" && toggles.showExplorer ? (
              <View style={{ gap: 18 }}>
                {toggles.showNotes && build.notes ? (
                  <View
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: glass.border.strong,
                      paddingLeft: 14,
                    }}
                  >
                    <ViewerMeta size={10} tone="fg55" bold tracking={0.2}>
                      {t("buildDetail.notesLabel")}
                    </ViewerMeta>
                    <ViewerBody size={13} tone="fg70" style={{ marginTop: 8 }}>
                      {build.notes}
                    </ViewerBody>
                  </View>
                ) : null}

                <View>
                  <ViewerMeta size={10} tone="fg55" bold tracking={0.2}>
                    {t("buildDetail.subElements")}
                  </ViewerMeta>
                  {outlineNodes.length === 0 ? (
                    <ViewerBody size={13} tone="fg55" style={{ marginTop: 10 }}>
                      {t("publicBuild.explorerEmpty")}
                    </ViewerBody>
                  ) : (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {outlineNodes.map((node) => (
                        <View
                          key={node._id as string}
                          style={[
                            FIELD_BOX,
                            {
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              marginLeft: Math.min(node.depth, 8) * 10,
                            },
                          ]}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "baseline",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <ViewerMeta size={9} tone="fg55" tracking={0.14}>
                              {node.nodeType === "material"
                                ? t("elements.typeMaterial")
                                : t("elements.typeElement")}
                            </ViewerMeta>
                            <ViewerBody size={13} tone="fg" semiBold numberOfLines={1}>
                              {node.name}
                            </ViewerBody>
                          </View>
                          <ViewerHairlineProgress
                            percent={node.progressPercent}
                            style={{ marginTop: 8 }}
                          />
                          <ViewerMeta size={9} tone="fg55" style={{ marginTop: 6 }}>
                            {t("elements.progressPercent", {
                              pct: Math.round(node.progressPercent),
                            })}
                          </ViewerMeta>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {tab === "tasks" && toggles.showTasks ? (
              <View style={{ gap: 14 }}>
                {workflowRows.length === 0 ? (
                  <ViewerBody size={13} tone="fg55">
                    {t("publicBuild.tasksEmpty")}
                  </ViewerBody>
                ) : (
                  workflowGrouped.sortedKeys.map((groupKey) => {
                    const rows = workflowGrouped.grouped.get(groupKey);
                    if (!rows?.length) return null;

                    const isBuildGroup = groupKey === BUILD_WORKFLOW_GROUP_KEY;
                    const meta = !isBuildGroup ? visualById.get(groupKey) : null;

                    return (
                      <View key={groupKey}>
                        <ViewerMeta
                          size={10}
                          tone="fg70"
                          bold
                          style={{ marginLeft: (meta?.depth ?? 0) * 10 }}
                        >
                          {isBuildGroup
                            ? t("buildDetail.buildWideSteps")
                            : (meta?.name ?? t("common.elements"))}
                        </ViewerMeta>
                        <View style={{ marginTop: 8, gap: 8 }}>
                          {rows.map((row) => {
                            const done = row.status === "done";
                            return (
                              <View
                                key={row._id as string}
                                style={[
                                  FIELD_BOX,
                                  {
                                    paddingHorizontal: 12,
                                    paddingVertical: 10,
                                    marginLeft: row.depth * 12,
                                  },
                                ]}
                              >
                                <View
                                  style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
                                >
                                  <View
                                    style={{
                                      marginTop: 1,
                                      height: 22,
                                      width: 22,
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: 11,
                                      borderWidth: 1,
                                      borderColor: done ? glass.surface.solid : glass.border.strong,
                                      backgroundColor: done ? glass.surface.solid : "transparent",
                                    }}
                                  >
                                    {done ? (
                                      <Ionicons name="checkmark" size={13} color={glass.text.ink} />
                                    ) : null}
                                  </View>
                                  <View style={{ minWidth: 0, flex: 1 }}>
                                    <ViewerBody size={13} tone={done ? "fg45" : "fg"} strike={done}>
                                      {row.title}
                                    </ViewerBody>
                                    <ViewerMeta size={9} tone="fg55" style={{ marginTop: 4 }}>
                                      {row.dueDate
                                        ? t("publicBuild.taskDue", { date: row.dueDate })
                                        : t("elements.progressPercent", {
                                            pct: Math.round(row.progressPercent),
                                          })}
                                    </ViewerMeta>
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {tab === "board" && toggles.showVisualBoard ? (
              <View style={{ gap: 18 }}>
                <PublicMediaRail
                  title={t("buildDetail.referenceImages")}
                  items={bundle.referenceImages}
                />
                <PublicMediaRail
                  title={t("buildDetail.processPictures")}
                  items={bundle.processPictures}
                />
                <View>
                  <ViewerMeta size={10} tone="fg55" bold tracking={0.2}>
                    {t("buildDetail.tabBoard")}
                  </ViewerMeta>
                  {bundle.visualNodes.length === 0 ? (
                    <ViewerBody size={13} tone="fg55" style={{ marginTop: 10 }}>
                      {t("buildDetail.boardEmpty")}
                    </ViewerBody>
                  ) : (
                    <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                      {boardColumns.map((col, colIndex) => (
                        <View key={`col-${colIndex}`} style={{ flex: 1, gap: 10 }}>
                          {col.map((node, rowIndex) => {
                            const tall = (colIndex + rowIndex) % 2 === 0;
                            return (
                              <View
                                key={node._id as string}
                                style={{
                                  borderRadius: 16,
                                  overflow: "hidden",
                                  borderWidth: borderWidth.hairline,
                                  borderColor: glass.border.divider,
                                  backgroundColor: glass.surface.field,
                                }}
                              >
                                <View style={{ height: tall ? 150 : 110 }}>
                                  <PublicMediaImage
                                    imageStorageId={node.imageStorageId}
                                    imageUrl={node.imageUrl}
                                  />
                                </View>
                                <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      fontFamily: APP_FONT_FAMILIES.displayItalic,
                                      fontStyle: "italic",
                                      fontSize: 17,
                                      lineHeight: 20,
                                      color: glass.text.fg,
                                    }}
                                  >
                                    {node.name}
                                  </Text>
                                  <ViewerHairlineProgress
                                    percent={node.progressPercent}
                                    style={{ marginTop: 8 }}
                                  />
                                  <ViewerMeta size={9} tone="fg55" style={{ marginTop: 6 }}>
                                    {t("elements.progressPercent", {
                                      pct: Math.round(node.progressPercent),
                                    })}
                                  </ViewerMeta>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {tab === "summary" && (toggles.showSummary || toggles.showCollaborators) ? (
              <View style={{ gap: 18 }}>
                {summaryMetrics.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {summaryMetrics.map((item) => (
                      <View
                        key={item.key}
                        style={[
                          FIELD_BOX,
                          {
                            minWidth: "46%",
                            flex: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                          },
                        ]}
                      >
                        <ViewerBody size={12} tone="fg70">
                          {item.label}
                        </ViewerBody>
                      </View>
                    ))}
                  </View>
                ) : null}

                {toggles.showCollaborators ? (
                  <View>
                    <ViewerMeta size={9} tone="fg55" tracking={0.2} bold>
                      {t("buildDetail.collaborators")}
                    </ViewerMeta>
                    <Text
                      style={{
                        marginTop: 4,
                        fontFamily: APP_FONT_FAMILIES.displayItalic,
                        fontStyle: "italic",
                        fontSize: 24,
                        lineHeight: 28,
                        color: glass.text.fg,
                      }}
                    >
                      {t("publicBuild.teamTitle")}
                    </Text>
                    {bundle.collaborators.length === 0 ? (
                      <ViewerBody size={13} tone="fg55" style={{ marginTop: 12 }}>
                        {t("publicBuild.collaboratorsEmpty")}
                      </ViewerBody>
                    ) : (
                      <View style={{ marginTop: 12, gap: 8 }}>
                        {bundle.collaborators.map((collaborator) => (
                          <View
                            key={collaborator.collaboratorId as string}
                            style={[
                              FIELD_BOX,
                              {
                                minHeight: 44,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                              },
                            ]}
                          >
                            <ViewerBody
                              size={13}
                              tone="fg"
                              numberOfLines={1}
                              style={{ minWidth: 0, flex: 1 }}
                            >
                              {collaborator.displayLabel}
                            </ViewerBody>
                            <ViewerMeta size={9} tone="fg55">
                              {collaborator.role === "editor"
                                ? t("buildDetail.roleEditor")
                                : collaborator.role === "viewer"
                                  ? t("buildDetail.roleViewer")
                                  : collaborator.role}
                            </ViewerMeta>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Comments (8c) */}
            <View
              style={{
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.divider,
                paddingTop: 14,
              }}
            >
              <ViewerMeta size={10} tone="fg55" bold tracking={0.2}>
                {`${t("social.commentsTitle")} · ${comments.length}`}
              </ViewerMeta>
              {comments.length === 0 ? (
                <ViewerBody size={13} tone="fg55" style={{ marginTop: 10 }}>
                  {t("social.commentsEmpty")}
                </ViewerBody>
              ) : (
                <View style={{ marginTop: 12, gap: 12 }}>
                  {comments.map((comment) => (
                    <View
                      key={comment._id}
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: 10,
                        borderBottomWidth: borderWidth.hairline,
                        borderBottomColor: glass.border.divider,
                        paddingBottom: 12,
                      }}
                    >
                      <View
                        style={{
                          height: 28,
                          width: 28,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 14,
                          borderWidth: borderWidth.hairline,
                          borderColor: glass.border.divider,
                          backgroundColor: glass.surface.field,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: APP_FONT_FAMILIES.displayItalic,
                            fontSize: 12,
                            color: glass.text.fg70,
                          }}
                        >
                          {(comment.authorUsername ?? comment.authorName)
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ minWidth: 0, flex: 1 }}>
                        <ViewerMeta size={9} tone="fg70" bold tracking={0.14}>
                          {comment.authorUsername
                            ? `@${comment.authorUsername}`
                            : comment.authorName}
                        </ViewerMeta>
                        <ViewerBody size={13} tone="fg" style={{ marginTop: 4 }}>
                          {comment.body}
                        </ViewerBody>
                        <ViewerMeta size={9} tone="fg45" style={{ marginTop: 4 }} tracking={0.14}>
                          {new Date(comment.createdAt).toLocaleString()}
                        </ViewerMeta>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {currentUserId ? (
                <View
                  style={{
                    marginTop: 14,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 10,
                  }}
                >
                  <TextInput
                    value={commentBody}
                    onChangeText={setCommentBody}
                    placeholder={t("social.commentPlaceholder")}
                    placeholderTextColor={glass.text.fg55}
                    multiline
                    style={{
                      minWidth: 0,
                      flex: 1,
                      minHeight: 40,
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: glass.border.strong,
                      fontFamily: APP_FONT_FAMILIES.sansRegular,
                      fontSize: 13,
                      color: glass.text.fg,
                    }}
                  />
                  <Pressable
                    onPress={() => void handleAddComment()}
                    disabled={!commentBody.trim() || commentPending}
                    accessibilityRole="button"
                    className="active:opacity-80"
                    style={[
                      { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
                      (!commentBody.trim() || commentPending) && { opacity: 0.4 },
                    ]}
                  >
                    <ViewerMeta size={10} tone="fg" bold>
                      {commentPending ? t("social.commentPosting") : t("social.commentAction")}
                    </ViewerMeta>
                  </Pressable>
                </View>
              ) : (
                <ViewerBody size={13} tone="fg55" style={{ marginTop: 14 }}>
                  {t("social.commentsSignIn")}
                </ViewerBody>
              )}
            </View>
          </ScrollView>
        </GlassPanel>
      </View>
    </View>
  );
}
