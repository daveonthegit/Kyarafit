import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
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
import { DataBoundary } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";
import { TaskSwipeRow } from "@/screens/build-detail/TaskSwipeRow";

type ParentRef = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType: string;
  linkId: Id<"cosplayNodeLinks">;
};

type WorkflowTreeNode = {
  _id: Id<"workflowItems">;
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

export default function ElementDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const id = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const node = useQuery(api.cosplayNodes.get, id ? { id } : "skip");
  const imageUrl = useQuery(
    api.files.getUrl,
    node?.imageStorageId ? { storageId: node.imageStorageId } : "skip"
  );

  const loading =
    identity === undefined || (id != null && node === undefined);
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
            <Text className="text-base font-semibold text-neutral-900">{t("elements.editShort")}</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, node?.name, id, router, t]);

  return (
    <DataBoundary<ElementDetailLoaded> status={status} data={data} error={error}>
      {(loaded) => (
        <ElementDetailBody
          loaded={loaded}
          heroUri={imageUrl ?? null}
          onLinkBuild={() =>
            router.push(APP_HREF.elementLinkBuild(loaded.id as string))
          }
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function ElementDetailBody({
  loaded,
  heroUri,
  onLinkBuild,
  t,
}: {
  loaded: ElementDetailLoaded;
  heroUri: string | null;
  onLinkBuild: () => void;
  t: TFunction;
}) {
  const update = useMutation(api.cosplayNodes.update);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const createWorkflowTask = useMutation(api.workflow.create);
  const updateWorkflowTask = useMutation(api.workflow.update);
  const deleteWorkflowTask = useMutation(api.workflow.remove);
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

  const visibleWorkflowRows = useMemo(() => {
    const source =
      workflowScope === "shared"
        ? (nodeWorkflow?.shared ?? [])
        : (nodeWorkflow?.buildSpecific ?? []);
    return flattenWorkflow(source as WorkflowTreeNode[]).filter((task) => {
      const isDone = task.status === "done";
      const matchesFilter =
        workflowTaskFilter === "all" ||
        (workflowTaskFilter === "open" ? !isDone : isDone);
      return matchesFilter;
    });
  }, [
    nodeWorkflow?.buildSpecific,
    nodeWorkflow?.shared,
    workflowScope,
    workflowTaskFilter,
  ]);

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
        <View
          className={`flex-row items-stretch border-b border-neutral-100 ${isActive ? "opacity-80" : ""}`}
        >
          <Pressable
            className="flex-1 py-4 pr-2"
            onPress={() => router.push(APP_HREF.element(item._id as string))}
          >
            <Text className="text-base font-medium text-neutral-900">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-neutral-500">
              {formatNodeTypeLabel(item.nodeType as CosplayNodeType)} · {formatNodeStatus(item)}
            </Text>
          </Pressable>
          <Pressable
            onLongPress={drag}
            delayLongPress={120}
            className="justify-center px-2"
            accessibilityLabel={t("elements.dragToReorder")}
          >
            <Text className="text-lg text-neutral-400">☰</Text>
          </Pressable>
          <Pressable
            className="justify-center px-2"
            onPress={() => confirmRemoveLink(item.linkId, item.name)}
            accessibilityLabel={t("elements.unlinkChild")}
          >
            <Text className="text-base font-semibold text-red-600">×</Text>
          </Pressable>
        </View>
      </ScaleDecorator>
    ),
    [confirmRemoveLink, router, t]
  );

  const uri = heroUri ?? node.imageUrl ?? null;

  const statusPickCurrent =
    workflowStatusPickId &&
    visibleWorkflowRows.find((r) => r._id === workflowStatusPickId)?.status;

  return (
    <>
    <ScrollView className="flex-1 bg-white">
      <View className="aspect-[4/5] w-full bg-neutral-100">
        {uri ? (
          <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-5xl text-neutral-300">
              {node.nodeType === "material" ? "◇" : "◆"}
            </Text>
          </View>
        )}
      </View>

      <View className="px-4 pb-10 pt-4">
        <Text className="text-xs uppercase tracking-wide text-neutral-500">
          {formatNodeTypeLabel(node.nodeType as CosplayNodeType)}
          {node.category ? ` · ${node.category}` : ""}
        </Text>
        <Text className="mt-1 text-2xl font-semibold text-neutral-900">{node.name}</Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <MetaChip label={t("elements.progressPercent", { pct: node.progressPercent ?? 0 })} />
          <MetaChip label={formatOverallBucket(node.overallBucket)} />
          <MetaChip label={statusLabel} />
        </View>

        <Text className="mt-3 text-sm text-neutral-600">{costLabel}</Text>

        <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("elements.adjustStatus")}
        </Text>
        {node.nodeType === "element" ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Pressable
              onPress={openPurchaseSheet}
              className="rounded-full border border-neutral-200 px-4 py-2"
            >
              <Text className="text-sm text-neutral-800">{t("elements.statusPurchase")}</Text>
            </Pressable>
            <Pressable
              onPress={openBuildSheet}
              className="rounded-full border border-neutral-200 px-4 py-2"
            >
              <Text className="text-sm text-neutral-800">{t("elements.statusBuild")}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-2 flex-row flex-wrap gap-2">
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
                className={`rounded-full border px-3 py-1.5 ${
                  node.materialStatus === s ? "border-neutral-900 bg-neutral-900" : "border-neutral-200"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    node.materialStatus === s ? "text-white" : "text-neutral-800"
                  }`}
                >
                  {s.replace("_", " ")}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={onLinkBuild}
          className="mt-8 rounded-xl bg-neutral-900 py-4 active:opacity-90"
        >
          <Text className="text-center text-base font-semibold text-white">
            {t("elements.linkToOutfit")}
          </Text>
        </Pressable>

        <Text className="mt-10 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("elements.workflowSection")}
        </Text>
        <View className="mt-3 flex-row rounded-xl border border-neutral-200 p-1">
          <Pressable
            onPress={() => setWorkflowScope("shared")}
            className={`flex-1 rounded-lg py-2 ${workflowScope === "shared" ? "bg-neutral-900" : ""}`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                workflowScope === "shared" ? "text-white" : "text-neutral-700"
              }`}
            >
              {t("elements.workflowShared")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setWorkflowScope("outfit")}
            className={`flex-1 rounded-lg py-2 ${workflowScope === "outfit" ? "bg-neutral-900" : ""}`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                workflowScope === "outfit" ? "text-white" : "text-neutral-700"
              }`}
            >
              {t("elements.workflowOutfit")}
            </Text>
          </Pressable>
        </View>

        {workflowScope === "outfit" && buildsUsing.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 max-h-12"
            contentContainerStyle={{ gap: 8, alignItems: "center", paddingVertical: 4 }}
          >
            {buildsUsing.map((b) => {
              const selected = selectedWorkflowBuildId === b._id;
              return (
                <Pressable
                  key={b._id}
                  onPress={() =>
                    setSelectedWorkflowBuildId(selected ? "" : (b._id as Id<"builds">))
                  }
                  className={`rounded-full border px-3 py-1.5 ${
                    selected ? "border-neutral-900 bg-neutral-900" : "border-neutral-200 bg-neutral-50"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${selected ? "text-white" : "text-neutral-800"}`}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {workflowScope === "outfit" && buildsUsing.length === 0 ? (
          <Text className="mt-2 text-sm text-neutral-500">{t("elements.workflowNoOutfits")}</Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["all", "open", "done"] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setWorkflowTaskFilter(f)}
              className={`rounded-full border px-3 py-1.5 ${
                workflowTaskFilter === f ? "border-neutral-900 bg-neutral-900" : "border-neutral-200"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  workflowTaskFilter === f ? "text-white" : "text-neutral-800"
                }`}
              >
                {f === "all"
                  ? t("elements.workflowFilterAll")
                  : f === "open"
                    ? t("elements.workflowFilterOpen")
                    : t("elements.workflowFilterDone")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-2 text-xs text-neutral-500">
          {t("elements.workflowCount", {
            count: workflowSummary.total,
            done: workflowSummary.done,
          })}
        </Text>

        {nodeWorkflow === undefined ? (
          <Text className="mt-3 text-sm text-neutral-500">{t("elements.workflowLoading")}</Text>
        ) : workflowScope === "outfit" && buildsUsing.length > 0 && !selectedWorkflowBuildId ? (
          <Text className="mt-3 text-sm text-neutral-500">{t("elements.workflowPickOutfit")}</Text>
        ) : visibleWorkflowRows.length === 0 ? (
          <Text className="mt-3 text-sm text-neutral-500">{t("elements.workflowEmpty")}</Text>
        ) : (
          <View className="mt-3">
            {visibleWorkflowRows.map((task) => {
              const checked = task.status === "done";
              return (
                <View key={task._id} style={{ marginLeft: task.depth * 12 }}>
                  <TaskSwipeRow checked={checked} onToggle={() => toggleWorkflowDone(task._id, !checked)}>
                    <View className="flex-row items-center gap-2 px-3 py-3">
                      <Pressable
                        onPress={() => toggleWorkflowDone(task._id, !checked)}
                        className="h-8 w-8 items-center justify-center rounded-full border border-neutral-300"
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                      >
                        <Text className="text-sm">{checked ? "✓" : ""}</Text>
                      </Pressable>
                      <View className="min-w-0 flex-1">
                        <Text
                          className={`text-base ${checked ? "text-neutral-400 line-through" : "text-neutral-900"}`}
                        >
                          {task.title}
                        </Text>
                        <Text className="mt-0.5 text-xs text-neutral-500">
                          {task.kind} · {task.status.replace(/_/g, " ")} · {task.progressPercent}%
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setWorkflowStatusPickId(task._id)}
                        className="px-2 py-1"
                        accessibilityLabel={t("elements.workflowStatus")}
                      >
                        <Text className="text-lg text-neutral-500">⋯</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmRemoveWorkflowTask(task._id, task.title)}
                        className="px-2 py-1"
                        accessibilityLabel={t("elements.workflowRemoveAction")}
                      >
                        <Text className="text-base font-semibold text-red-600">×</Text>
                      </Pressable>
                    </View>
                  </TaskSwipeRow>
                </View>
              );
            })}
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
            placeholderTextColor="#a3a3a3"
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-base text-neutral-900"
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
          <Pressable
            onPress={() => void handleAddWorkflowTask()}
            disabled={
              !userId ||
              !newWorkflowLabel.trim() ||
              (workflowScope === "outfit" &&
                buildsUsing.length > 0 &&
                !selectedWorkflowBuildId)
            }
            className="rounded-xl bg-neutral-900 px-4 py-3 active:opacity-90 disabled:opacity-40"
          >
            <Text className="text-sm font-semibold text-white">{t("elements.workflowAdd")}</Text>
          </Pressable>
        </View>

        <Text className="mt-10 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("elements.graphLinks")}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() =>
              router.push(APP_HREF.elementLinkChild(id as string))
            }
            className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2"
          >
            <Text className="text-sm font-medium text-neutral-900">{t("elements.addChild")}</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(APP_HREF.elementLinkParent(id as string))
            }
            className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2"
          >
            <Text className="text-sm font-medium text-neutral-900">{t("elements.attachParent")}</Text>
          </Pressable>
        </View>

        {node.parents.length > 0 ? (
          <View className="mt-10">
            <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("elements.parents")}
            </Text>
            {node.parents.map((p: ParentRef) => (
              <View
                key={p._id}
                className="mt-2 flex-row items-center border-b border-neutral-100 py-3"
              >
                <Pressable
                  className="min-w-0 flex-1"
                  onPress={() => router.push(APP_HREF.element(p._id as string))}
                >
                  <Text className="text-base font-medium text-neutral-900">{p.name}</Text>
                  <Text className="mt-0.5 text-xs text-neutral-500">
                    {formatNodeTypeLabel(p.nodeType as CosplayNodeType)}
                  </Text>
                </Pressable>
                <Pressable
                  className="px-2 py-1"
                  onPress={() => confirmRemoveLink(p.linkId, p.name)}
                  accessibilityLabel={t("elements.unlinkParent")}
                >
                  <Text className="text-base font-semibold text-red-600">×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {node.children.length > 0 ? (
          <View className="mt-8">
            <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("elements.children")}
            </Text>
            <Text className="mt-1 text-xs text-neutral-500">{t("elements.childrenDragHint")}</Text>
            <DraggableFlatList
              className="mt-2"
              data={node.children}
              keyExtractor={(item) => item.linkId as string}
              onDragEnd={onDragEnd}
              renderItem={renderChild}
              scrollEnabled={false}
              style={{ flexGrow: 0 }}
            />
          </View>
        ) : null}
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
          className="max-h-[70%] rounded-t-2xl bg-white px-4 pb-8 pt-4"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="mb-3 text-center text-sm font-semibold text-neutral-900">
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
                className={`border-b border-neutral-100 py-3 ${statusPickCurrent === st ? "bg-neutral-50" : ""}`}
              >
                <Text className="text-base text-neutral-900">{st.replace(/_/g, " ")}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => setWorkflowStatusPickId(null)}
            className="mt-3 rounded-xl border border-neutral-200 py-3"
          >
            <Text className="text-center text-base text-neutral-700">{t("common.cancel")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
      <Text className="text-xs font-medium text-neutral-800">{label}</Text>
    </View>
  );
}
