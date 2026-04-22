import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { TFunction } from "i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { WORKFLOW_STATUSES } from "@kyarafit/design-system/domain";
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
  const visualNodes = useQuery(api.cosplayNodes.listBuildVisualNodes, { buildId }) ?? [];

  const createWorkflow = useMutation(api.workflow.create);
  const updateWorkflow = useMutation(api.workflow.update);
  const removeWorkflow = useMutation(api.workflow.remove);

  const [newRootTitle, setNewRootTitle] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<Id<"workflowItems"> | null>(
    null
  );
  const [newChildTitle, setNewChildTitle] = useState("");
  const [statusPickId, setStatusPickId] = useState<Id<"workflowItems"> | null>(null);

  const roots = (tree?.items ?? []) as WorkflowTreeNodeShape[];
  const rows = useMemo(() => flattenWorkflowWithElementGroup(roots), [roots]);

  const visualById = useMemo(() => {
    const m = new Map<
      string,
      { sortOrder: number; depth: number; name: string; nodeType: string }
    >();
    for (const n of visualNodes) {
      m.set(n._id as string, {
        sortOrder: n.sortOrder,
        depth: n.depth,
        name: n.name,
        nodeType: n.nodeType,
      });
    }
    return m;
  }, [visualNodes]);

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

  const statusPickCurrent =
    statusPickId && rows.find((r) => r._id === statusPickId)?.status;

  if (tree === undefined) {
    return (
      <Text className="px-4 py-4 text-sm text-neutral-500">{t("elements.workflowLoading")}</Text>
    );
  }

  return (
    <View className="flex-1">
      <View className="mx-4 mt-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
        <View className="flex-row items-end justify-between">
          <Text className="text-sm font-semibold text-neutral-900">
            {t("buildDetail.workflowProgress")}
          </Text>
          <Text className="text-sm text-neutral-500">{progressPercent}%</Text>
        </View>
        <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <View
            className="h-full rounded-full bg-neutral-900"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="mt-2 text-xs text-neutral-500">
          {t("buildDetail.workflowDoneCount", {
            done: stats?.tasksDone ?? 0,
            total: stats?.tasksTotal ?? 0,
          })}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-12">
        {rows.length === 0 ? (
          <View className="rounded-2xl border border-neutral-200 bg-white px-4 py-6 shadow-sm">
            <Text className="text-sm text-neutral-600">{t("buildDetail.workflowEmpty")}</Text>
          </View>
        ) : (
          sortedGroupKeys.map((groupKey) => {
            const groupRows = grouped.get(groupKey);
            if (!groupRows?.length) return null;

            const isBuild = groupKey === BUILD_WORKFLOW_GROUP_KEY;
            const meta = !isBuild ? visualById.get(groupKey) : null;
            const title = isBuild ? t("buildDetail.buildWideSteps") : (meta?.name ?? "Element");
            const headerDepth = isBuild ? 0 : meta?.depth ?? 0;
            const typeLabel =
              meta?.nodeType === "material"
                ? t("elements.typeMaterial")
                : t("elements.typeElement");

            return (
              <View
                key={groupKey}
                className="mb-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <View
                  className="flex-row items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-3"
                  style={{ paddingLeft: 12 + headerDepth * 10 }}
                >
                  <Text className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
                    {title}
                  </Text>
                  {!isBuild ? (
                    <Text className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {typeLabel}
                    </Text>
                  ) : (
                    <Text className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {t("buildDetail.buildGroupLabel")}
                    </Text>
                  )}
                </View>
                <View className="gap-2 px-2 py-3">
                  {groupRows.map((node) => (
                    <View
                      key={node._id as string}
                      style={{ marginLeft: node.depth * 14 }}
                      className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-2"
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
                          className="mt-0.5 h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white"
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: node.status === "done" }}
                        >
                          <Text className="text-sm">{node.status === "done" ? "✓" : ""}</Text>
                        </Pressable>
                        <View className="min-w-0 flex-1">
                          <Text
                            className={`text-base ${
                              node.status === "done"
                                ? "text-neutral-400 line-through"
                                : "text-neutral-900"
                            }`}
                          >
                            {node.title}
                          </Text>
                          <Text className="mt-0.5 text-xs text-neutral-500">
                            {node.kind} · {node.progressPercent}%
                            {node.dueDate ? ` · ${node.dueDate}` : ""}
                          </Text>
                        </View>
                      </View>
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        <Pressable
                          onPress={() => setStatusPickId(node._id)}
                          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5"
                        >
                          <Text className="text-xs text-neutral-700">
                            {node.status.replace(/_/g, " ")}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setNewChildParentId(node._id)}
                          className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5"
                        >
                          <Text className="text-xs font-medium text-neutral-800">
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
                                onPress: () =>
                                  void removeWorkflow({ id: node._id, userId }),
                              },
                            ])
                          }
                          className="rounded-lg border border-red-200 bg-white px-2 py-1.5"
                        >
                          <Text className="text-xs text-red-600">{t("elements.workflowRemoveAction")}</Text>
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
          <View className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <TextInput
              value={newChildTitle}
              onChangeText={setNewChildTitle}
              placeholder={t("buildDetail.subtaskPlaceholder")}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-neutral-900"
              onSubmitEditing={() => void handleCreateChild()}
            />
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => void handleCreateChild()}
                className="flex-1 items-center rounded-xl bg-neutral-900 py-2.5"
              >
                <Text className="text-sm font-semibold text-white">{t("common.save")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setNewChildParentId(null);
                  setNewChildTitle("");
                }}
                className="flex-1 items-center rounded-xl border border-neutral-200 py-2.5"
              >
                <Text className="text-sm text-neutral-700">{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-2 border-t border-neutral-200 pt-4">
          <TextInput
            value={newRootTitle}
            onChangeText={setNewRootTitle}
            placeholder={t("buildDetail.workflowAddStep")}
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-neutral-900"
            onSubmitEditing={() => void handleCreateRoot()}
          />
          <Pressable
            onPress={() => void handleCreateRoot()}
            disabled={!newRootTitle.trim()}
            className="justify-center rounded-xl bg-neutral-900 px-4 py-2 disabled:opacity-40"
          >
            <Text className="text-xs font-semibold text-white">{t("buildDetail.addStep")}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={statusPickId !== null} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setStatusPickId(null)}
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
                    if (statusPickId) {
                      void updateWorkflow({ id: statusPickId, userId, status: st });
                    }
                    setStatusPickId(null);
                  }}
                  className={`border-b border-neutral-100 py-3 ${
                    statusPickCurrent === st ? "bg-neutral-50" : ""
                  }`}
                >
                  <Text className="text-base text-neutral-900">{st.replace(/_/g, " ")}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setStatusPickId(null)}
              className="mt-3 rounded-xl border border-neutral-200 py-3"
            >
              <Text className="text-center text-base text-neutral-700">{t("common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
