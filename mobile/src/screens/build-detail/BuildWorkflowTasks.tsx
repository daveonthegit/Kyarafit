import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { TFunction } from "i18next";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { GlassTextField } from "@/ui/glass";
import { GlassBody, GlassHairlineProgress, GlassMeta, GlassOutlineButton, GlassSolidButton } from "./glassAtoms";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { WORKFLOW_STATUSES } from "@kyarafit/design-system/domain";
import type { DropZone, PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import { WorkflowTaskEditorModal } from "@/components/workflow/WorkflowTaskEditorModal";
import { WorkflowTaskDragHandle } from "@/components/workflow/WorkflowTaskDragHandle";
import { WorkflowTaskDragOverlay } from "@/components/workflow/WorkflowTaskDragOverlay";
import { WorkflowTaskDragShell } from "@/components/workflow/WorkflowTaskDragShell";
import { WorkflowTaskRootDropZone } from "@/components/workflow/WorkflowTaskRootDropZone";
import { usePlannerTaskMove } from "@/planner/usePlannerTaskMove";
import { applyWorkflowTreeDrop, promoteWorkflowTaskToRoot } from "@/workflow/applyWorkflowTreeDrop";
import {
  BUILD_WORKFLOW_GROUP_KEY,
  flattenWorkflowWithElementGroup,
  sortWorkflowGroupKeys,
  type WorkflowRowFlat,
  type WorkflowTreeNodeShape,
} from "./buildWorkflowTreeHelpers";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";
import { useOfflineMutation, useOfflineQuery } from "@/offline";

type Props = {
  buildId: Id<"builds">;
  userId: string;
  t: TFunction;
};

export function BuildWorkflowTasks({ buildId, userId, t }: Props) {
  const tree = useOfflineQuery(api.workflow.listBuildTree, { buildId });
  const visualNodesQuery = useOfflineQuery(api.cosplayNodes.listBuildVisualNodes, { buildId });

  const createWorkflow = useOfflineMutation(api.workflow.create);
  const updateWorkflow = useOfflineMutation(api.workflow.update);
  const removeWorkflow = useOfflineMutation(api.workflow.remove);
  const moveWorkflow = useOfflineMutation(api.workflow.move);
  const moveAndResequenceWorkflow = useOfflineMutation(api.workflow.moveAndResequence);

  const [newRootTitle, setNewRootTitle] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<Id<"workflowItems"> | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [statusPickId, setStatusPickId] = useState<Id<"workflowItems"> | null>(null);
  const [editorTaskId, setEditorTaskId] = useState<Id<"workflowItems"> | null>(null);
  const roots = useMemo(() => (tree?.items ?? []) as WorkflowTreeNodeShape[], [tree?.items]);
  const rows = useMemo(() => flattenWorkflowWithElementGroup(roots), [roots]);

  const visualById = useMemo(() => {
    const m = new Map<
      string,
      { sortOrder: number; depth: number; name: string; nodeType: string }
    >();
    for (const n of visualNodesQuery ?? []) {
      m.set(n._id as string, {
        sortOrder: n.sortOrder,
        depth: n.depth,
        name: n.name,
        nodeType: n.nodeType,
      });
    }
    return m;
  }, [visualNodesQuery]);

  const { grouped, sortedGroupKeys } = useMemo(() => {
    const g = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = g.get(row.elementGroupKey) ?? [];
      list.push(row);
      g.set(row.elementGroupKey, list);
    }
    const keys = sortWorkflowGroupKeys(Array.from(g.keys()), visualById);
    return { grouped: g, sortedGroupKeys: keys };
  }, [rows, visualById]);

  const editorCandidates = useMemo(
    () => rows.map((row) => ({ _id: row._id, title: row.title })),
    [rows]
  );

  const flatDropTasks = useMemo(
    () =>
      rows.map((r) => ({
        _id: r._id,
        parentId: r.parentId ?? null,
        sortOrder: r.sortOrder ?? 0,
        scopeKey: `wf:build:${buildId as string}:${r.elementGroupKey}`,
      })),
    [buildId, rows]
  );

  const taskElementGroupById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r._id as string, r.elementGroupKey);
    return m;
  }, [rows]);

  const siblingIndexById = useMemo(() => {
    const m = new Map<string, number>();
    const byKey = new Map<string, WorkflowTreeNodeShape[]>();
    for (const r of rows) {
      const k = `${r.elementGroupKey}\0${r.parentId ?? ""}`;
      const list = byKey.get(k) ?? [];
      list.push(r);
      byKey.set(k, list);
    }
    for (const list of byKey.values()) {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      list.forEach((n, i) => m.set(n._id as string, i));
    }
    return m;
  }, [rows]);

  const applyDrop = useCallback(
    async (dragged: PlannerTaskDragMeta, target: PlannerTaskDragMeta, zone: DropZone) => {
      await applyWorkflowTreeDrop(
        dragged,
        target,
        zone,
        flatDropTasks,
        {
          userId,
          moveTask: moveWorkflow,
          updateTask: updateWorkflow,
          moveAndResequence: moveAndResequenceWorkflow,
        },
        (D, T) =>
          taskElementGroupById.get(D._id as string) === taskElementGroupById.get(T._id as string)
      );
    },
    [
      flatDropTasks,
      moveAndResequenceWorkflow,
      moveWorkflow,
      taskElementGroupById,
      updateWorkflow,
      userId,
    ]
  );

  const promoteTaskToRoot = useCallback(
    async (dragged: PlannerTaskDragMeta, scopeKey: string) => {
      await promoteWorkflowTaskToRoot(
        dragged,
        flatDropTasks,
        {
          userId,
          moveTask: moveWorkflow,
          updateTask: updateWorkflow,
          moveAndResequence: moveAndResequenceWorkflow,
        },
        (task) =>
          `wf:build:${buildId as string}:${taskElementGroupById.get(task._id as string)}` ===
          scopeKey
      );
    },
    [
      buildId,
      flatDropTasks,
      moveAndResequenceWorkflow,
      moveWorkflow,
      taskElementGroupById,
      updateWorkflow,
      userId,
    ]
  );

  const plannerTaskMove = usePlannerTaskMove({
    userId,
    onCommitDrop: applyDrop,
    onCommitRootDrop: promoteTaskToRoot,
    onError: (message) => Alert.alert(t("common.errorTitle"), message),
  });

  const rootViewRef = useRef<View>(null);
  const [rootFrame, setRootFrame] = useState({ x: 0, y: 0 });

  const updateRootFrame = useCallback(() => {
    rootViewRef.current?.measureInWindow?.((x, y) => {
      setRootFrame({ x, y });
    });
  }, []);

  useEffect(() => {
    if (!plannerTaskMove.dragMeta) return;
    updateRootFrame();
  }, [plannerTaskMove.dragMeta, updateRootFrame]);

  const stats = tree?.stats;
  const progressPercent = stats?.workflowProgressPercent ?? 0;

  const handleCreateRoot = async () => {
    if (!newRootTitle.trim()) return;
    try {
      await createWorkflow({
        userId,
        title: newRootTitle.trim(),
        kind: "task",
        category: "craft",
        scopeKind: "build_specific",
        attachments: [{ entityType: "build", entityId: buildId, role: "primary" }],
      });
      setNewRootTitle("");
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  };

  const handleCreateChild = async () => {
    if (!newChildParentId || !newChildTitle.trim()) return;
    try {
      await createWorkflow({
        userId,
        title: newChildTitle.trim(),
        kind: "task",
        category: "craft",
        scopeKind: "build_specific",
        parentId: newChildParentId,
      });
      setNewChildTitle("");
      setNewChildParentId(null);
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  };

  const statusPickCurrent = statusPickId && rows.find((r) => r._id === statusPickId)?.status;

  if (tree === undefined) {
    return (
      <GlassBody size={13} tone="fg55" style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
        {t("elements.workflowLoading")}
      </GlassBody>
    );
  }

  return (
    <View ref={rootViewRef} className="flex-1" onLayout={updateRootFrame}>
      <View
        style={{
          marginHorizontal: 14,
          marginTop: 14,
          borderRadius: 12,
          borderWidth: borderWidth.hairline,
          borderColor: glass.border.divider,
          backgroundColor: glass.surface.field,
          padding: 14,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <GlassBody size={13} tone="fg" semiBold>
              {t("buildDetail.workflowProgress")}
            </GlassBody>
            <GlassBody size={12} tone="fg55" style={{ marginTop: 4 }}>
              {t("buildDetail.workflowCardHint")}
            </GlassBody>
          </View>
          <GlassBody size={13} tone="fg70">
            {`${progressPercent}%`}
          </GlassBody>
        </View>
        <GlassHairlineProgress percent={progressPercent} style={{ marginTop: 10 }} />
        <GlassMeta size={9} tone="fg55" style={{ marginTop: 8 }}>
          {t("buildDetail.workflowDoneCount", {
            done: stats?.tasksDone ?? 0,
            total: stats?.tasksTotal ?? 0,
          })}
        </GlassMeta>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerClassName="pb-12"
        scrollEnabled={!plannerTaskMove.dragMeta}
      >
        {rows.length === 0 ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.divider,
              backgroundColor: glass.surface.field,
              paddingHorizontal: 14,
              paddingVertical: 22,
            }}
          >
            <GlassBody size={13} tone="fg55">
              {t("buildDetail.workflowEmpty")}
            </GlassBody>
          </View>
        ) : (
          sortedGroupKeys.map((groupKey) => {
            const groupRows = grouped.get(groupKey);
            if (!groupRows?.length) return null;

            const isBuild = groupKey === BUILD_WORKFLOW_GROUP_KEY;
            const meta = !isBuild ? visualById.get(groupKey) : null;
            const title = isBuild ? t("buildDetail.buildWideSteps") : (meta?.name ?? "Element");
            const headerDepth = isBuild ? 0 : (meta?.depth ?? 0);
            const typeLabel =
              meta?.nodeType === "material"
                ? t("elements.typeMaterial")
                : t("elements.typeElement");

            return (
              <View
                key={groupKey}
                style={{
                  marginBottom: 14,
                  overflow: "hidden",
                  borderRadius: 12,
                  borderWidth: borderWidth.hairline,
                  borderColor: glass.border.divider,
                  backgroundColor: glass.surface.field,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderBottomWidth: borderWidth.hairline,
                    borderBottomColor: glass.border.divider,
                    paddingVertical: 12,
                    paddingRight: 12,
                    paddingLeft: 12 + headerDepth * 10,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      minWidth: 0,
                      flex: 1,
                      fontFamily: APP_FONT_FAMILIES.displayItalic,
                      fontStyle: "italic",
                      fontSize: 17,
                      color: glass.text.fg,
                    }}
                  >
                    {title}
                  </Text>
                  <GlassMeta size={9} tone="fg55">
                    {!isBuild ? typeLabel : t("buildDetail.buildGroupLabel")}
                  </GlassMeta>
                </View>
                <View className="gap-2 px-2 py-3">
                  <WorkflowTaskRootDropZone
                    scopeKey={`wf:build:${buildId as string}:${groupKey}`}
                    taskMove={plannerTaskMove}
                    label={t("buildDetail.dropToTopLevel", {
                      defaultValue: "Drop here to make it a top-level step",
                    })}
                  />
                  {groupRows.map((node) => (
                    <BuildWorkflowTaskRow
                      key={node._id as string}
                      buildId={buildId}
                      node={node}
                      t={t}
                      plannerTaskMove={plannerTaskMove}
                      siblingIndexById={siblingIndexById}
                      onToggleDone={() =>
                        void updateWorkflow({
                          id: node._id,
                          userId,
                          status: node.status === "done" ? "not_started" : "done",
                        })
                      }
                      onOpenEditor={() => setEditorTaskId(node._id)}
                      onOpenStatus={() => setStatusPickId(node._id)}
                      onAddSubtask={() => setNewChildParentId(node._id)}
                      onRemove={() =>
                        Alert.alert(t("elements.workflowRemoveTitle"), node.title, [
                          { text: t("common.cancel"), style: "cancel" },
                          {
                            text: t("elements.workflowRemoveAction"),
                            style: "destructive",
                            onPress: () => void removeWorkflow({ id: node._id, userId }),
                          },
                        ])
                      }
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}

        {newChildParentId ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 12,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.divider,
              backgroundColor: glass.surface.field,
              padding: 12,
            }}
          >
            <GlassTextField
              value={newChildTitle}
              onChangeText={setNewChildTitle}
              placeholder={t("buildDetail.subtaskPlaceholder")}
              onSubmitEditing={() => void handleCreateChild()}
            />
            <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
              <GlassOutlineButton
                label={t("common.save")}
                onPress={() => void handleCreateChild()}
                style={{ flex: 1 }}
              />
              <GlassOutlineButton
                label={t("common.cancel")}
                onPress={() => {
                  setNewChildParentId(null);
                  setNewChildTitle("");
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}

        <View
          style={{
            marginTop: 22,
            flexDirection: "row",
            gap: 10,
            borderTopWidth: borderWidth.hairline,
            borderTopColor: glass.border.divider,
            paddingTop: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <GlassTextField
              value={newRootTitle}
              onChangeText={setNewRootTitle}
              placeholder={t("buildDetail.workflowAddStep")}
              onSubmitEditing={() => void handleCreateRoot()}
            />
          </View>
          <GlassSolidButton
            label={t("buildDetail.addStep")}
            onPress={() => void handleCreateRoot()}
            disabled={!newRootTitle.trim()}
            style={{ paddingHorizontal: 18 }}
          />
        </View>
      </ScrollView>

      <Modal visible={statusPickId !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
          onPress={() => setStatusPickId(null)}
        >
          <Pressable
            style={{
              maxHeight: "70%",
              borderTopLeftRadius: glass.radius.sheet,
              borderTopRightRadius: glass.radius.sheet,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.overlay,
              backgroundColor: glass.fallback.overlay,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 32,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                alignSelf: "center",
                marginBottom: 12,
                height: 4,
                width: 44,
                borderRadius: 2,
                backgroundColor: glass.border.strong,
              }}
            />
            <GlassBody
              size={13}
              tone="fg"
              semiBold
              style={{ marginBottom: 10, textAlign: "center" }}
            >
              {t("elements.workflowStatus")}
            </GlassBody>
            <ScrollView>
              {WORKFLOW_STATUSES.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => {
                    if (statusPickId) {
                      void updateWorkflow({ id: statusPickId, userId, status: st });
                    }
                    setStatusPickId(null);
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    borderBottomWidth: borderWidth.hairline,
                    borderBottomColor: glass.border.divider,
                    borderRadius: statusPickCurrent === st ? 10 : 0,
                    paddingHorizontal: 10,
                    backgroundColor:
                      statusPickCurrent === st ? glass.surface.field : "transparent",
                  }}
                >
                  <GlassBody size={14} tone={statusPickCurrent === st ? "fg" : "fg70"}>
                    {st.replace(/_/g, " ")}
                  </GlassBody>
                </Pressable>
              ))}
            </ScrollView>
            <GlassOutlineButton
              label={t("common.cancel")}
              onPress={() => setStatusPickId(null)}
              style={{ marginTop: 12 }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <WorkflowTaskEditorModal
        visible={editorTaskId !== null}
        workflowItemId={editorTaskId}
        userId={userId}
        candidateTasks={editorCandidates}
        onClose={() => setEditorTaskId(null)}
      />

      <WorkflowTaskDragOverlay
        taskMove={plannerTaskMove}
        fallbackLabel={t("buildDetail.workflowTask", { defaultValue: "Task" })}
        rootOffset={rootFrame}
      />
    </View>
  );
}

function BuildWorkflowTaskRow({
  buildId,
  node,
  t,
  plannerTaskMove,
  siblingIndexById,
  onToggleDone,
  onOpenEditor,
  onOpenStatus,
  onAddSubtask,
  onRemove,
}: {
  buildId: Id<"builds">;
  node: WorkflowRowFlat;
  t: TFunction;
  plannerTaskMove: PlannerTaskMoveController;
  siblingIndexById: Map<string, number>;
  onToggleDone: () => void;
  onOpenEditor: () => void;
  onOpenStatus: () => void;
  onAddSubtask: () => void;
  onRemove: () => void;
}) {
  const dragMeta = useMemo<PlannerTaskDragMeta>(
    () => ({
      taskId: node._id as string,
      scopeKey: `wf:build:${buildId as string}:${node.elementGroupKey}`,
      parentId: node.parentId ? (node.parentId as string) : undefined,
      siblingIndex: siblingIndexById.get(node._id as string) ?? 0,
      ancestorIds: (node.ancestorIds ?? []).map((a) => a as string),
      title: node.title,
    }),
    [buildId, node, siblingIndexById]
  );

  return (
    <WorkflowTaskDragShell
      taskId={node._id}
      dragMeta={dragMeta}
      taskMove={plannerTaskMove}
      depthMargin={node.depth * 14}
      dropIntoLabel={t("buildDetail.dropIntoLabel")}
      rowLongPressDrag
    >
      <View className="p-3">
        <View className="flex-row items-start gap-2.5">
          <Pressable
            onPress={onToggleDone}
            hitSlop={12}
            className={`mt-0.5 h-[21px] w-[21px] items-center justify-center rounded-full ${
              node.status === "done"
                ? "bg-kyar-text dark:bg-kyar-dark-text"
                : "border-[1.5px] border-kyar-border bg-transparent dark:border-kyar-dark-border"
            }`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: node.status === "done" }}
          >
            <Text
              className={`text-[11px] ${
                node.status === "done"
                  ? "text-kyar-bg dark:text-kyar-dark-bg"
                  : "text-transparent"
              }`}
            >
              {node.status === "done" ? "✓" : ""}
            </Text>
          </Pressable>
          <Pressable onPress={onOpenEditor} className="min-w-0 flex-1">
            <Text
              className={`text-[13px] leading-[18px] ${
                node.status === "done"
                  ? "text-kyar-textTertiary line-through dark:text-kyar-dark-textTertiary"
                  : "text-kyar-text dark:text-kyar-dark-text"
              }`}
            >
              {node.title}
            </Text>
            <View className="mt-0.5 flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs text-kyar-meta dark:text-kyar-dark-meta">
                {node.kind} · {node.progressPercent}%
              </Text>
              {node.dueDate ? (
                <Text
                  className={`text-xs ${
                    node.status !== "done" && Date.parse(node.dueDate) < Date.now()
                      ? "text-kyar-danger dark:text-kyar-dark-danger"
                      : "text-kyar-meta dark:text-kyar-dark-meta"
                  }`}
                >
                  · {node.dueDate}
                </Text>
              ) : null}
              {node.status === "blocked" ? (
                <View className="rounded-full border border-kyar-danger/40 px-2 py-0.5">
                  <Text className="text-[9px] uppercase tracking-widest text-kyar-danger dark:text-kyar-dark-danger">
                    {t("buildDetail.taskBlocked", { defaultValue: "Blocked" })}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          <WorkflowTaskDragHandle
            taskId={node._id}
            dragMeta={dragMeta}
            taskMove={plannerTaskMove}
          />
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <Pressable
            onPress={onOpenStatus}
            className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
          >
            <Text className="text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {node.status.replace(/_/g, " ")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onOpenEditor}
            className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
          >
            <Text className="text-xs font-medium text-kyar-text dark:text-kyar-dark-text">
              {t("workflowEditor.editAction")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onAddSubtask}
            className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
          >
            <Text className="text-xs font-medium text-kyar-text dark:text-kyar-dark-text">
              {t("buildDetail.workflowSubtask")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onRemove}
            className="rounded-full border border-kyar-danger/30 bg-kyar-surface px-3 py-2 dark:bg-kyar-dark-surface"
          >
            <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
              {t("elements.workflowRemoveAction")}
            </Text>
          </Pressable>
        </View>
      </View>
    </WorkflowTaskDragShell>
  );
}
