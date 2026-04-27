import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import {
  ELEMENT_BUILD_STATUSES,
  ELEMENT_PURCHASE_STATUSES,
  MATERIAL_STATUSES,
} from "@kyarafit/design-system/types";
import {
  WORKFLOW_STATUSES,
  formatCostSummary,
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
} from "@kyarafit/design-system/domain";
import type { DropZone, PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import { APP_HREF } from "@/lib/appRoutes";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { WorkflowTaskDragHandle } from "@/components/workflow/WorkflowTaskDragHandle";
import { WorkflowTaskDragShell } from "@/components/workflow/WorkflowTaskDragShell";
import { WorkflowTaskRootDropZone } from "@/components/workflow/WorkflowTaskRootDropZone";
import { usePlannerTaskMove } from "@/planner/usePlannerTaskMove";
import { applyWorkflowTreeDrop, promoteWorkflowTaskToRoot } from "@/workflow/applyWorkflowTreeDrop";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";

type ParentRef = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType: string;
  linkId: Id<"cosplayNodeLinks">;
};

type WorkflowTreeNode = {
  _id: Id<"workflowItems">;
  parentId?: Id<"workflowItems"> | null;
  ancestorIds?: Id<"workflowItems">[];
  sortOrder?: number;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowTreeNode[];
};

function flattenWorkflow(
  nodes: WorkflowTreeNode[],
  depth = 0
): (WorkflowTreeNode & { depth: number })[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenWorkflow(node.children, depth + 1),
  ]);
}

type FlatWorkflowRow = WorkflowTreeNode & { depth: number };

type ChildRow = Doc<"cosplayNodes"> & {
  linkId: Id<"cosplayNodeLinks">;
  linkMode: string;
  sortOrder: number;
  overallBucket: string;
  progressPercent: number;
  directCostCents: number;
  totalCostCents: number;
  childCount: number;
  hasIncompleteDescendants: boolean;
};

export type ElementDetailLoaded = {
  id: Id<"cosplayNodes">;
  userId: string;
  node: Doc<"cosplayNodes"> & {
    overallBucket: string;
    progressPercent: number;
    directCostCents: number;
    totalCostCents: number;
    childCount: number;
    hasIncompleteDescendants: boolean;
    children: ChildRow[];
    parents: ParentRef[];
  };
};

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function prettyStatus(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "—";
}

export default function ElementDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const convertType = useMutation(api.cosplayNodes.convertType);
  const removeNode = useMutation(api.cosplayNodes.remove);
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const id = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const node = useQuery(api.cosplayNodes.get, id ? { id } : "skip");

  const loading = identity === undefined || (id != null && node === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!id || !userId || node === null) status = "empty";
  else status = "ready";

  const data: ElementDetailLoaded | undefined =
    status === "ready" && node && userId && id
      ? { id, userId, node: node as ElementDetailLoaded["node"] }
      : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: node?.name ?? "",
      headerRight: () =>
        id ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(APP_HREF.elementEdit(id as string))}
            className="mr-3"
          >
            <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("elements.editShort")}
            </Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, node?.name, id, router, t]);

  return (
    <DataBoundary<ElementDetailLoaded> status={status} data={data} error={error}>
      {(loaded) => (
        <ElementDetailBody
          loaded={loaded}
          onLinkBuild={() => router.push(APP_HREF.elementLinkBuild(loaded.id as string))}
          onConvert={async () => {
            try {
              await convertType({
                id: loaded.id,
                userId: loaded.userId,
                nodeType: loaded.node.nodeType === "element" ? "material" : "element",
              });
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            }
          }}
          onDelete={async () => {
            try {
              await removeNode({ id: loaded.id, userId: loaded.userId });
              router.replace(APP_HREF.elements);
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            }
          }}
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function ElementDetailBody({
  loaded,
  onLinkBuild,
  onConvert,
  onDelete,
  t,
}: {
  loaded: ElementDetailLoaded;
  onLinkBuild: () => void;
  onConvert: () => Promise<void>;
  onDelete: () => Promise<void>;
  t: TFunction;
}) {
  const { colors } = useDesignTheme();
  const update = useMutation(api.cosplayNodes.update);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const createWorkflowTask = useMutation(api.workflow.create);
  const updateWorkflowTask = useMutation(api.workflow.update);
  const deleteWorkflowTask = useMutation(api.workflow.remove);
  const moveWorkflowTask = useMutation(api.workflow.move);
  const router = useRouter();
  const { node, userId, id } = loaded;

  const [workflowScope, setWorkflowScope] = useState<"shared" | "outfit">("shared");
  const [selectedWorkflowBuildId, setSelectedWorkflowBuildId] = useState<Id<"builds"> | "">("");
  const [workflowTaskFilter, setWorkflowTaskFilter] = useState<"all" | "open" | "done">("all");
  const [newWorkflowLabel, setNewWorkflowLabel] = useState("");
  const [workflowStatusPickId, setWorkflowStatusPickId] = useState<Id<"workflowItems"> | null>(
    null
  );

  const buildsUsingRaw = useQuery(api.builds.getBuildsUsingNode, { cosplayNodeId: id });
  const buildsUsing = useMemo(() => buildsUsingRaw ?? [], [buildsUsingRaw]);
  const nodeWorkflow = useQuery(api.workflow.listNodeWorkflow, {
    cosplayNodeId: id,
    buildId: selectedWorkflowBuildId ? (selectedWorkflowBuildId as Id<"builds">) : undefined,
  });

  useEffect(() => {
    if (
      workflowScope === "outfit" &&
      !selectedWorkflowBuildId &&
      buildsUsing.length === 1 &&
      buildsUsing[0]
    ) {
      setSelectedWorkflowBuildId(buildsUsing[0]._id);
    }
  }, [workflowScope, selectedWorkflowBuildId, buildsUsing]);

  const fullWorkflowFlat = useMemo(() => {
    if (nodeWorkflow == null) return [];
    const source =
      workflowScope === "shared" ? (nodeWorkflow.shared ?? []) : (nodeWorkflow.buildSpecific ?? []);
    return flattenWorkflow(source as WorkflowTreeNode[]);
  }, [nodeWorkflow, workflowScope]);

  const visibleWorkflowRows = useMemo(() => {
    return fullWorkflowFlat.filter((task) => {
      const isDone = task.status === "done";
      const matchesFilter =
        workflowTaskFilter === "all" || (workflowTaskFilter === "open" ? !isDone : isDone);
      return matchesFilter;
    });
  }, [fullWorkflowFlat, workflowTaskFilter]);

  const workflowFlatDropTasks = useMemo(
    () =>
      fullWorkflowFlat.map((r) => ({
        _id: r._id,
        parentId: r.parentId ?? null,
        sortOrder: r.sortOrder ?? 0,
      })),
    [fullWorkflowFlat]
  );

  const workflowSiblingIndexById = useMemo(() => {
    const m = new Map<string, number>();
    const byParent = new Map<string, typeof fullWorkflowFlat>();
    for (const r of fullWorkflowFlat) {
      const pid = r.parentId ?? "";
      const list = byParent.get(pid) ?? [];
      list.push(r);
      byParent.set(pid, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      list.forEach((n, i) => m.set(n._id as string, i));
    }
    return m;
  }, [fullWorkflowFlat]);

  const workflowDragScopeKey = useMemo(() => {
    if (workflowScope === "shared") return `wf:element:${id as string}:shared`;
    return `wf:element:${id as string}:build:${selectedWorkflowBuildId as string}`;
  }, [workflowScope, id, selectedWorkflowBuildId]);

  const applyElementWorkflowDrop = useCallback(
    async (dragged: PlannerTaskDragMeta, target: PlannerTaskDragMeta, zone: DropZone) => {
      await applyWorkflowTreeDrop(dragged, target, zone, workflowFlatDropTasks, {
        userId,
        moveTask: moveWorkflowTask,
        updateTask: updateWorkflowTask,
      });
    },
    [moveWorkflowTask, updateWorkflowTask, userId, workflowFlatDropTasks]
  );

  const promoteElementWorkflowTaskToRoot = useCallback(
    async (dragged: PlannerTaskDragMeta) => {
      await promoteWorkflowTaskToRoot(dragged, workflowFlatDropTasks, {
        userId,
        moveTask: moveWorkflowTask,
        updateTask: updateWorkflowTask,
      });
    },
    [moveWorkflowTask, updateWorkflowTask, userId, workflowFlatDropTasks]
  );

  const plannerWorkflowMove = usePlannerTaskMove({
    userId,
    onCommitDrop: applyElementWorkflowDrop,
    onCommitRootDrop: promoteElementWorkflowTaskToRoot,
    onError: (message) => Alert.alert(t("common.errorTitle"), message),
  });

  const workflowSummary = useMemo(() => {
    const source =
      workflowScope === "shared"
        ? (nodeWorkflow?.shared ?? [])
        : (nodeWorkflow?.buildSpecific ?? []);
    const flat = flattenWorkflow(source as WorkflowTreeNode[]);
    const done = flat.filter((r) => r.status === "done").length;
    return { total: flat.length, done };
  }, [nodeWorkflow?.buildSpecific, nodeWorkflow?.shared, workflowScope]);

  const statusLabel = useMemo(() => formatNodeStatus(node), [node]);
  const costLabel = useMemo(() => formatCostSummary(node), [node]);
  const convertLabel =
    node.nodeType === "element" ? t("elements.convertToMaterial") : t("elements.convertToElement");

  const applyUpdate = (patch: Parameters<typeof update>[0]) => {
    void update({ ...patch, id, userId });
  };

  const openPurchaseSheet = () => {
    const buttons = ELEMENT_PURCHASE_STATUSES.map((s) => ({
      text: s.replace("_", " "),
      onPress: () =>
        applyUpdate({
          id,
          userId,
          purchaseStatus: s,
        }),
    }));
    Alert.alert(t("elements.sheetPurchase"), undefined, [
      ...buttons,
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const openBuildSheet = () => {
    const buttons = ELEMENT_BUILD_STATUSES.map((s) => ({
      text: s.replace("_", " "),
      onPress: () =>
        applyUpdate({
          id,
          userId,
          buildStatus: s,
        }),
    }));
    Alert.alert(t("elements.sheetBuild"), undefined, [
      ...buttons,
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const toggleWorkflowDone = useCallback(
    (taskId: Id<"workflowItems">, nextDone: boolean) => {
      void updateWorkflowTask({
        id: taskId,
        userId,
        status: nextDone ? "done" : "not_started",
      });
    },
    [updateWorkflowTask, userId]
  );

  const confirmRemoveWorkflowTask = useCallback(
    (taskId: Id<"workflowItems">, title: string) => {
      Alert.alert(t("elements.workflowRemoveTitle"), title, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.workflowRemoveAction"),
          style: "destructive",
          onPress: () => {
            void deleteWorkflowTask({ id: taskId, userId });
          },
        },
      ]);
    },
    [deleteWorkflowTask, t, userId]
  );

  const handleAddWorkflowTask = useCallback(async () => {
    const label = newWorkflowLabel.trim();
    if (!label || !userId) return;
    if (workflowScope === "outfit" && buildsUsing.length > 0 && !selectedWorkflowBuildId) {
      Alert.alert(t("common.errorTitle"), t("elements.workflowPickOutfit"));
      return;
    }
    const isBuildSpecific = workflowScope === "outfit" && !!selectedWorkflowBuildId;
    try {
      await createWorkflowTask({
        userId,
        title: label,
        kind: "task",
        category: "craft",
        scopeKind: isBuildSpecific ? "build_specific" : "shared",
        attachments: isBuildSpecific
          ? [
              {
                entityType: "build",
                entityId: selectedWorkflowBuildId as Id<"builds">,
                role: "primary",
                buildContextId: selectedWorkflowBuildId as Id<"builds">,
              },
              {
                entityType: "cosplayNode",
                entityId: id,
                role: "progress_source",
                buildContextId: selectedWorkflowBuildId as Id<"builds">,
              },
            ]
          : [{ entityType: "cosplayNode", entityId: id, role: "primary" }],
      });
      setNewWorkflowLabel("");
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [
    buildsUsing.length,
    createWorkflowTask,
    id,
    newWorkflowLabel,
    selectedWorkflowBuildId,
    userId,
    workflowScope,
    t,
  ]);

  const confirmRemoveLink = useCallback(
    (linkId: Id<"cosplayNodeLinks">, label: string) => {
      Alert.alert(t("elements.unlinkConfirmTitle"), label, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.unlinkConfirmAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeChildLink({ id: linkId, userId });
              } catch (e) {
                Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
              }
            })();
          },
        },
      ]);
    },
    [removeChildLink, t, userId]
  );

  const confirmUnlinkBuild = useCallback(
    (buildId: Id<"builds">, name: string) => {
      Alert.alert(t("elements.unlinkConfirmTitle"), name, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.unlinkConfirmAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeNodeFromBuild({ userId, buildId, cosplayNodeId: id });
              } catch (e) {
                Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
              }
            })();
          },
        },
      ]);
    },
    [id, removeNodeFromBuild, t, userId]
  );

  const onDragEnd = useCallback(
    async ({ data }: { data: ChildRow[] }) => {
      try {
        await reorderChildren({
          parentNodeId: id,
          userId,
          orderedLinkIds: data.map((c) => c.linkId),
        });
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [id, reorderChildren, userId, t]
  );

  const renderChild = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ChildRow>) => (
      <ScaleDecorator>
        <Pressable
          onPress={() => router.push(APP_HREF.element(item._id as string))}
          onLongPress={drag}
          delayLongPress={160}
          className={`px-4 py-3 ${isActive ? "opacity-75" : ""}`}
        >
          <View className="flex-row items-center gap-3">
            {item.imageStorageId || item.imageUrl ? (
              <ConvexStorageImage
                storageId={item.imageStorageId}
                imageUrl={item.imageUrl}
                className="h-16 w-16 rounded-2xl"
                accessibilityLabel={item.name}
              />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-kyar-panel dark:bg-kyar-dark-panel">
                <Text className="text-2xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {item.nodeType === "material" ? "◇" : "◆"}
                </Text>
              </View>
            )}

            <View className="min-w-0 flex-1">
              <MetaLabel>
                {formatNodeTypeLabel(item.nodeType as CosplayNodeType)} ·{" "}
                {formatOverallBucket(item.overallBucket)}
              </MetaLabel>
              <Text
                className="mt-1 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                numberOfLines={1}
              >
                {formatNodeStatus(item)}
              </Text>
            </View>

            <View className="items-end gap-2">
              <Ionicons name="reorder-three" size={18} color={colors.textTertiary} />
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  confirmRemoveLink(item.linkId, item.name);
                }}
                hitSlop={8}
                accessibilityLabel={t("elements.unlinkChild")}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </ScaleDecorator>
    ),
    [colors.textSecondary, colors.textTertiary, confirmRemoveLink, router, t]
  );

  const statusPickCurrent =
    workflowStatusPickId && visibleWorkflowRows.find((r) => r._id === workflowStatusPickId)?.status;

  return (
    <>
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        scrollEnabled={!plannerWorkflowMove.dragMeta}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 48,
          gap: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <SurfaceCard className="overflow-hidden">
          {node.imageStorageId || node.imageUrl ? (
            <ConvexStorageImage
              storageId={node.imageStorageId}
              imageUrl={node.imageUrl}
              className="h-80 w-full"
              accessibilityLabel={node.name}
            />
          ) : (
            <View className="h-72 items-center justify-center bg-kyar-panel dark:bg-kyar-dark-panel">
              <Text className="text-6xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {node.nodeType === "material" ? "◇" : "◆"}
              </Text>
            </View>
          )}

          <View className="px-5 py-5">
            <MetaLabel>
              {formatNodeTypeLabel(node.nodeType as CosplayNodeType)}
              {node.category ? ` · ${node.category}` : ""}
            </MetaLabel>

            <View className="mt-4 flex-row flex-wrap gap-2">
              <DetailChip
                label={t("elements.progressPercent", { pct: node.progressPercent ?? 0 })}
              />
              <DetailChip label={formatOverallBucket(node.overallBucket)} />
              <DetailChip label={statusLabel} />
            </View>

            {node.notes ? (
              <Text className="mt-5 text-base leading-7 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {node.notes}
              </Text>
            ) : null}
          </View>
        </SurfaceCard>

        <View className="flex-row gap-3">
          <StatCard label={t("elements.adjustStatus")} value={statusLabel} />
          <StatCard label={t("elements.pricingSection")} value={costLabel} />
        </View>

        <View className="flex-row gap-3">
          <StatCard
            label={t("elements.directCostLabel")}
            value={formatCurrency(node.directCostCents)}
          />
          <StatCard label={t("elements.children")} value={String(node.childCount ?? 0)} />
        </View>

        <View>
          <SectionHeading title={t("elements.managementSection")} />
          <SurfaceCard className="mt-4 px-4 py-4">
            <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("elements.managementSubtitle")}
            </Text>
            <View className="mt-4 flex-row flex-wrap gap-3">
              <Button
                title={convertLabel}
                variant="secondary"
                onPress={() =>
                  Alert.alert(t("elements.convertTitle"), convertLabel, [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("elements.convertAction"),
                      onPress: () => {
                        void onConvert();
                      },
                    },
                  ])
                }
              />
              <Button
                title={t("elements.deleteNode")}
                variant="secondary"
                onPress={() =>
                  Alert.alert(t("elements.deleteNodeTitle"), t("elements.deleteNodeBody"), [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("elements.deleteNodeAction"),
                      style: "destructive",
                      onPress: () => {
                        void onDelete();
                      },
                    },
                  ])
                }
              />
            </View>
          </SurfaceCard>
        </View>

        <View>
          <SectionHeading title={t("elements.adjustStatus")} />
          <SurfaceCard className="mt-4 px-4 py-4">
            {node.nodeType === "element" ? (
              <View className="gap-3">
                <StatusRow
                  label={t("elements.statusPurchase")}
                  value={prettyStatus(node.purchaseStatus)}
                  onPress={openPurchaseSheet}
                />
                <StatusRow
                  label={t("elements.statusBuild")}
                  value={prettyStatus(node.buildStatus)}
                  onPress={openBuildSheet}
                />
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {MATERIAL_STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() =>
                      applyUpdate({
                        id,
                        userId,
                        materialStatus: s,
                      })
                    }
                    className={`rounded-full border px-4 py-2 ${
                      node.materialStatus === s
                        ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                        : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        node.materialStatus === s
                          ? "text-kyar-bg dark:text-kyar-dark-bg"
                          : "text-kyar-text dark:text-kyar-dark-text"
                      }`}
                    >
                      {s.replace("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </SurfaceCard>
        </View>

        <View>
          <SectionHeading
            title={t("elements.linkBuildTitle")}
            action={<Button title={t("elements.linkToOutfit")} onPress={onLinkBuild} />}
          />
          <SurfaceCard className="mt-4 px-4 py-4">
            <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("elements.linkBuildSubtitle")}
            </Text>

            {buildsUsingRaw === undefined ? (
              <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {t("elements.workflowLoading")}
              </Text>
            ) : buildsUsing.length === 0 ? (
              <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {t("elements.linkBuildEmpty")}
              </Text>
            ) : (
              <View className="mt-4 gap-3">
                {buildsUsing.map((build) => (
                  <Pressable
                    key={build._id}
                    onPress={() => router.push(APP_HREF.build(build._id as string))}
                    className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <MetaLabel>{build.character || t("common.builds")}</MetaLabel>
                        <Text
                          className="mt-1 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text"
                          numberOfLines={1}
                        >
                          {build.name}
                        </Text>
                      </View>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          confirmUnlinkBuild(build._id, build.name);
                        }}
                        hitSlop={8}
                        accessibilityLabel={t("elements.unlinkConfirmAction")}
                      >
                        <Ionicons name="close" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </SurfaceCard>
        </View>

        <View>
          <SectionHeading title={t("elements.workflowSection")} />
          <SurfaceCard className="mt-4 px-4 py-4">
            <View className="flex-row rounded-full border border-kyar-borderSubtle bg-kyar-panel p-1 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
              <SegmentedPill
                active={workflowScope === "shared"}
                label={t("elements.workflowShared")}
                onPress={() => setWorkflowScope("shared")}
              />
              <SegmentedPill
                active={workflowScope === "outfit"}
                label={t("elements.workflowOutfit")}
                onPress={() => setWorkflowScope("outfit")}
              />
            </View>

            {workflowScope === "outfit" && buildsUsing.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-4"
                contentContainerStyle={{ gap: 8 }}
              >
                {buildsUsing.map((b) => {
                  const selected = selectedWorkflowBuildId === b._id;
                  return (
                    <FilterPill
                      key={b._id}
                      active={selected}
                      label={b.name}
                      onPress={() =>
                        setSelectedWorkflowBuildId(selected ? "" : (b._id as Id<"builds">))
                      }
                    />
                  );
                })}
              </ScrollView>
            ) : null}

            {workflowScope === "outfit" && buildsUsing.length === 0 ? (
              <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {t("elements.workflowNoOutfits")}
              </Text>
            ) : null}

            <View className="mt-4 flex-row flex-wrap gap-2">
              {(["all", "open", "done"] as const).map((f) => (
                <FilterPill
                  key={f}
                  active={workflowTaskFilter === f}
                  label={
                    f === "all"
                      ? t("elements.workflowFilterAll")
                      : f === "open"
                        ? t("elements.workflowFilterOpen")
                        : t("elements.workflowFilterDone")
                  }
                  onPress={() => setWorkflowTaskFilter(f)}
                />
              ))}
            </View>

            <Text className="mt-4 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("elements.workflowCount", {
                count: workflowSummary.total,
                done: workflowSummary.done,
              })}
            </Text>

            {workflowTaskFilter !== "all" ? (
              <Text className="mt-2 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.workflowDragRequiresAllFilter", {
                  defaultValue: "Switch to “All” to reorder tasks with drag and drop.",
                })}
              </Text>
            ) : null}

            {nodeWorkflow === undefined ? (
              <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {t("elements.workflowLoading")}
              </Text>
            ) : workflowScope === "outfit" && buildsUsing.length > 0 && !selectedWorkflowBuildId ? (
              <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {t("elements.workflowPickOutfit")}
              </Text>
            ) : visibleWorkflowRows.length === 0 ? (
              <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {t("elements.workflowEmpty")}
              </Text>
            ) : (
              <View className="mt-4 gap-3">
                {workflowTaskFilter === "all" ? (
                  <WorkflowTaskRootDropZone
                    scopeKey={workflowDragScopeKey}
                    taskMove={plannerWorkflowMove}
                    label={t("elements.workflowDropToTopLevel", {
                      defaultValue: "Drop here to make it a top-level task",
                    })}
                  />
                ) : null}
                {visibleWorkflowRows.map((task) => (
                  <ElementWorkflowTaskRow
                    key={task._id}
                    task={task}
                    dragEnabled={workflowTaskFilter === "all"}
                    workflowDragScopeKey={workflowDragScopeKey}
                    siblingIndexById={workflowSiblingIndexById}
                    taskMove={plannerWorkflowMove}
                    colors={colors}
                    t={t}
                    checked={task.status === "done"}
                    onToggle={() => toggleWorkflowDone(task._id, task.status !== "done")}
                    onOpenStatus={() => setWorkflowStatusPickId(task._id)}
                    onRemove={() => confirmRemoveWorkflowTask(task._id, task.title)}
                  />
                ))}
              </View>
            )}

            <View className="mt-4 flex-row items-end gap-2">
              <TextInput
                value={newWorkflowLabel}
                onChangeText={setNewWorkflowLabel}
                placeholder={
                  workflowScope === "outfit"
                    ? t("elements.workflowAddPlaceholderOutfit")
                    : t("elements.workflowAddPlaceholderShared")
                }
                placeholderTextColor={colors.textTertiary}
                className="min-h-[46px] flex-1 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
                editable={
                  !!userId &&
                  !(
                    workflowScope === "outfit" &&
                    buildsUsing.length > 0 &&
                    !selectedWorkflowBuildId
                  )
                }
                onSubmitEditing={() => void handleAddWorkflowTask()}
              />
              <Button
                title={t("elements.workflowAdd")}
                onPress={() => void handleAddWorkflowTask()}
                disabled={
                  !userId ||
                  !newWorkflowLabel.trim() ||
                  (workflowScope === "outfit" && buildsUsing.length > 0 && !selectedWorkflowBuildId)
                }
              />
            </View>
          </SurfaceCard>
        </View>

        <View>
          <SectionHeading title={t("elements.graphLinks")} />
          <SurfaceCard className="mt-4 px-4 py-4">
            <View className="flex-row flex-wrap gap-2">
              <Button
                title={t("elements.addChild")}
                variant="secondary"
                onPress={() => router.push(APP_HREF.elementLinkChild(id as string))}
              />
              <Button
                title={t("elements.attachParent")}
                variant="secondary"
                onPress={() => router.push(APP_HREF.elementLinkParent(id as string))}
              />
            </View>

            {node.parents.length > 0 ? (
              <View className="mt-6 gap-3">
                <MetaLabel>{t("elements.parents")}</MetaLabel>
                {node.parents.map((p) => (
                  <HierarchyRow
                    key={p._id}
                    title={p.name}
                    subtitle={formatNodeTypeLabel(p.nodeType as CosplayNodeType)}
                    onPress={() => router.push(APP_HREF.element(p._id as string))}
                    onRemove={() => confirmRemoveLink(p.linkId, p.name)}
                  />
                ))}
              </View>
            ) : null}

            <View className="mt-6">
              <MetaLabel>{t("elements.children")}</MetaLabel>
              {node.children.length > 0 ? (
                <>
                  <Text className="mt-2 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                    {t("elements.childrenDragHint")}
                  </Text>
                  <DraggableFlatList
                    className="mt-3"
                    data={node.children}
                    keyExtractor={(item) => item.linkId as string}
                    onDragEnd={onDragEnd}
                    renderItem={renderChild}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => (
                      <View className="mx-4 border-t border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle" />
                    )}
                    style={{ flexGrow: 0 }}
                  />
                </>
              ) : (
                <Text className="mt-3 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.linkChildSubtitle")}
                </Text>
              )}
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>

      <Modal
        visible={workflowStatusPickId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setWorkflowStatusPickId(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setWorkflowStatusPickId(null)}
        >
          <Pressable
            className="max-h-[70%] rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-4 pb-8 pt-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-3 text-center text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("elements.workflowStatus")}
            </Text>
            <ScrollView>
              {WORKFLOW_STATUSES.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => {
                    if (workflowStatusPickId) {
                      void updateWorkflowTask({
                        id: workflowStatusPickId,
                        userId,
                        status: st,
                      });
                    }
                    setWorkflowStatusPickId(null);
                  }}
                  className={`border-b border-kyar-borderSubtle py-3 dark:border-kyar-dark-borderSubtle ${
                    statusPickCurrent === st ? "bg-kyar-panel dark:bg-kyar-dark-panel" : ""
                  }`}
                >
                  <Text className="text-base text-kyar-text dark:text-kyar-dark-text">
                    {st.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button
              title={t("common.cancel")}
              variant="secondary"
              onPress={() => setWorkflowStatusPickId(null)}
              className="mt-4"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ElementWorkflowTaskRow({
  task,
  dragEnabled,
  workflowDragScopeKey,
  siblingIndexById,
  taskMove,
  colors,
  t,
  checked,
  onToggle,
  onOpenStatus,
  onRemove,
}: {
  task: FlatWorkflowRow;
  dragEnabled: boolean;
  workflowDragScopeKey: string;
  siblingIndexById: Map<string, number>;
  taskMove: PlannerTaskMoveController;
  colors: { textSecondary: string };
  t: TFunction;
  checked: boolean;
  onToggle: () => void;
  onOpenStatus: () => void;
  onRemove: () => void;
}) {
  const dragMeta = useMemo<PlannerTaskDragMeta>(
    () => ({
      taskId: task._id as string,
      scopeKey: workflowDragScopeKey,
      parentId: task.parentId ? (task.parentId as string) : undefined,
      siblingIndex: siblingIndexById.get(task._id as string) ?? 0,
      ancestorIds: (task.ancestorIds ?? []).map((a) => a as string),
    }),
    [siblingIndexById, task, workflowDragScopeKey]
  );

  const body: ReactNode = (
    <View className="px-3 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onToggle}
          className="h-9 w-9 items-center justify-center rounded-full border border-kyar-border dark:border-kyar-dark-border"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
            {checked ? "✓" : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenStatus}
          className="min-w-0 flex-1 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={task.title}
        >
          <Text
            className={`text-base ${
              checked
                ? "text-kyar-textTertiary line-through dark:text-kyar-dark-textTertiary"
                : "text-kyar-text dark:text-kyar-dark-text"
            }`}
          >
            {task.title}
          </Text>
          <Text className="mt-1 text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
            {task.kind} · {task.status.replace(/_/g, " ")} · {task.progressPercent}%
          </Text>
        </Pressable>

        {dragEnabled ? (
          <WorkflowTaskDragHandle taskId={task._id} dragMeta={dragMeta} taskMove={taskMove} />
        ) : null}
        <Pressable
          onPress={onOpenStatus}
          hitSlop={8}
          accessibilityLabel={t("elements.workflowStatus")}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel={t("elements.workflowRemoveAction")}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  if (!dragEnabled) {
    return (
      <View style={{ marginLeft: task.depth * 12 }}>
        <View className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
          {body}
        </View>
      </View>
    );
  }

  return (
    <WorkflowTaskDragShell
      taskId={task._id}
      dragMeta={dragMeta}
      taskMove={taskMove}
      depthMargin={task.depth * 12}
      dropIntoLabel={t("buildDetail.dropIntoLabel")}
    >
      {body}
    </WorkflowTaskDragShell>
  );
}

function DetailChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-kyar-borderSubtle bg-kyar-panel px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
      <Text className="text-xs font-medium text-kyar-text dark:text-kyar-dark-text">{label}</Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <SurfaceCard className="flex-1 px-4 py-4">
      <MetaLabel>{label}</MetaLabel>
      <Text className="mt-3 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
        {value}
      </Text>
    </SurfaceCard>
  );
}

function StatusRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useDesignTheme();

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <MetaLabel>{label}</MetaLabel>
          <Text className="mt-1 text-base font-medium text-kyar-text dark:text-kyar-dark-text">
            {value}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

function SegmentedPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full px-4 py-3 ${
        active ? "bg-kyar-text dark:bg-kyar-dark-text" : "bg-transparent"
      }`}
    >
      <Text
        className={`text-center text-sm font-medium ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilterPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function HierarchyRow({
  title,
  subtitle,
  onPress,
  onRemove,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors } = useDesignTheme();

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
            {title}
          </Text>
          <Text className="mt-1 text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}
