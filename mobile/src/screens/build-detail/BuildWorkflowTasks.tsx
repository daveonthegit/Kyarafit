import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { TFunction } from "i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { WORKFLOW_STATUSES } from "@kyarafit/design-system/domain";
import { WorkflowTaskEditorModal } from "@/components/workflow/WorkflowTaskEditorModal";
import { WorkflowTemplateModal } from "@/components/workflow/WorkflowTemplateModal";
import {
  BUILD_WORKFLOW_GROUP_KEY,
  flattenWorkflowWithElementGroup,
  sortWorkflowGroupKeys,
  type WorkflowTreeNodeShape,
} from "./buildWorkflowTreeHelpers";

type Props = {
  buildId: Id<"builds">;
  userId: string;
  t: TFunction;
};

export function BuildWorkflowTasks({ buildId, userId, t }: Props) {
  const tree = useQuery(api.workflow.listBuildTree, { buildId });
  const visualNodesQuery = useQuery(api.cosplayNodes.listBuildVisualNodes, { buildId });

  const createWorkflow = useMutation(api.workflow.create);
  const updateWorkflow = useMutation(api.workflow.update);
  const removeWorkflow = useMutation(api.workflow.remove);

  const [newRootTitle, setNewRootTitle] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<Id<"workflowItems"> | null>(null);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [statusPickId, setStatusPickId] = useState<Id<"workflowItems"> | null>(null);
  const [editorTaskId, setEditorTaskId] = useState<Id<"workflowItems"> | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

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
      <Text className="px-4 py-4 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {t("elements.workflowLoading")}
      </Text>
    );
  }

  return (
    <View className="flex-1">
      <View className="mx-4 mt-2 rounded-3xl border border-kyar-borderSubtle bg-kyar-panel p-4 shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("buildDetail.workflowProgress")}
            </Text>
            <Text className="mt-2 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("workflowTemplates.buildHint")}
            </Text>
          </View>
          <View className="items-end gap-2">
            <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {progressPercent}%
            </Text>
            <Pressable
              onPress={() => setTemplateOpen(true)}
              className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            >
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                {t("workflowTemplates.open")}
              </Text>
            </Pressable>
          </View>
        </View>
        <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-kyar-borderSubtle dark:bg-kyar-dark-borderSubtle">
          <View
            className="h-full rounded-full bg-kyar-text dark:bg-kyar-dark-text"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="mt-2 text-xs text-kyar-meta dark:text-kyar-dark-meta">
          {t("buildDetail.workflowDoneCount", {
            done: stats?.tasksDone ?? 0,
            total: stats?.tasksTotal ?? 0,
          })}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-12">
        {rows.length === 0 ? (
          <View className="rounded-3xl border border-kyar-borderSubtle bg-kyar-surface px-4 py-6 shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface">
            <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("buildDetail.workflowEmpty")}
            </Text>
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
                className="mb-4 overflow-hidden rounded-3xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
              >
                <View
                  className="flex-row items-center gap-2 border-b border-kyar-borderSubtle bg-kyar-panel px-3 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                  style={{ paddingLeft: 12 + headerDepth * 10 }}
                >
                  <Text className="min-w-0 flex-1 text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                    {title}
                  </Text>
                  {!isBuild ? (
                    <Text className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                      {typeLabel}
                    </Text>
                  ) : (
                    <Text className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                      {t("buildDetail.buildGroupLabel")}
                    </Text>
                  )}
                </View>
                <View className="gap-2 px-2 py-3">
                  {groupRows.map((node) => (
                    <View
                      key={node._id as string}
                      style={{ marginLeft: node.depth * 14 }}
                      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel p-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                    >
                      <View className="flex-row items-start gap-2">
                        <Pressable
                          onPress={() =>
                            void updateWorkflow({
                              id: node._id,
                              userId,
                              status: node.status === "done" ? "not_started" : "done",
                            })
                          }
                          className="mt-0.5 h-8 w-8 items-center justify-center rounded-full border border-kyar-border bg-kyar-surface dark:border-kyar-dark-border dark:bg-kyar-dark-surface"
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: node.status === "done" }}
                        >
                          <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
                            {node.status === "done" ? "✓" : ""}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditorTaskId(node._id)}
                          className="min-w-0 flex-1"
                        >
                          <Text
                            className={`text-base ${
                              node.status === "done"
                                ? "text-kyar-textTertiary line-through dark:text-kyar-dark-textTertiary"
                                : "text-kyar-text dark:text-kyar-dark-text"
                            }`}
                          >
                            {node.title}
                          </Text>
                          <Text className="mt-0.5 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                            {node.kind} · {node.progressPercent}%
                            {node.dueDate ? ` · ${node.dueDate}` : ""}
                          </Text>
                        </Pressable>
                      </View>
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => setStatusPickId(node._id)}
                          className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                        >
                          <Text className="text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                            {node.status.replace(/_/g, " ")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setEditorTaskId(node._id)}
                          className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                        >
                          <Text className="text-xs font-medium text-kyar-text dark:text-kyar-dark-text">
                            {t("workflowEditor.editAction")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setNewChildParentId(node._id)}
                          className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                        >
                          <Text className="text-xs font-medium text-kyar-text dark:text-kyar-dark-text">
                            {t("buildDetail.workflowSubtask")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            Alert.alert(t("elements.workflowRemoveTitle"), node.title, [
                              { text: t("common.cancel"), style: "cancel" },
                              {
                                text: t("elements.workflowRemoveAction"),
                                style: "destructive",
                                onPress: () => void removeWorkflow({ id: node._id, userId }),
                              },
                            ])
                          }
                          className="rounded-full border border-kyar-danger/30 bg-kyar-surface px-3 py-2 dark:bg-kyar-dark-surface"
                        >
                          <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
                            {t("elements.workflowRemoveAction")}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}

        {newChildParentId ? (
          <View className="mt-4 rounded-3xl border border-kyar-borderSubtle bg-kyar-surface p-3 shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface">
            <TextInput
              value={newChildTitle}
              onChangeText={setNewChildTitle}
              placeholder={t("buildDetail.subtaskPlaceholder")}
              className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-3 py-3 text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              onSubmitEditing={() => void handleCreateChild()}
            />
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => void handleCreateChild()}
                className="flex-1 items-center rounded-full bg-kyar-text py-3 dark:bg-kyar-dark-text"
              >
                <Text className="text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                  {t("common.save")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNewChildParentId(null);
                  setNewChildTitle("");
                }}
                className="flex-1 items-center rounded-full border border-kyar-borderSubtle py-3 dark:border-kyar-dark-borderSubtle"
              >
                <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-2 border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
          <TextInput
            value={newRootTitle}
            onChangeText={setNewRootTitle}
            placeholder={t("buildDetail.workflowAddStep")}
            className="min-h-[44px] flex-1 rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 py-3 text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface dark:text-kyar-dark-text"
            onSubmitEditing={() => void handleCreateRoot()}
          />
          <Pressable
            onPress={() => void handleCreateRoot()}
            disabled={!newRootTitle.trim()}
            className="justify-center rounded-full bg-kyar-text px-4 py-2 disabled:opacity-40 dark:bg-kyar-dark-text"
          >
            <Text className="text-xs font-semibold text-kyar-bg dark:text-kyar-dark-bg">
              {t("buildDetail.addStep")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={statusPickId !== null} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-end bg-kyar-text/40 dark:bg-kyar-dark-text/40"
          onPress={() => setStatusPickId(null)}
        >
          <Pressable
            className="max-h-[70%] rounded-t-3xl bg-kyar-surface px-4 pb-8 pt-4 dark:bg-kyar-dark-surface"
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
                    if (statusPickId) {
                      void updateWorkflow({ id: statusPickId, userId, status: st });
                    }
                    setStatusPickId(null);
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
            <Pressable
              onPress={() => setStatusPickId(null)}
              className="mt-3 rounded-full border border-kyar-borderSubtle py-3 dark:border-kyar-dark-borderSubtle"
            >
              <Text className="text-center text-base text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("common.cancel")}
              </Text>
            </Pressable>
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

      <WorkflowTemplateModal
        visible={templateOpen}
        userId={userId}
        attachments={[{ entityType: "build", entityId: buildId, role: "primary" }]}
        scopeKind="build_specific"
        buildContextId={buildId}
        onClose={() => setTemplateOpen(false)}
      />
    </View>
  );
}
