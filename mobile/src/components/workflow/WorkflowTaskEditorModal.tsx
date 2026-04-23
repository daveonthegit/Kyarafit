import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { WORKFLOW_STATUSES } from "@kyarafit/design-system/domain";
import { Button } from "@/ui";
import { useDesignTheme } from "@/theme/useDesignTheme";

type CandidateTask = {
  _id: Id<"workflowItems">;
  title: string;
};

type EditorData = {
  _id: Id<"workflowItems">;
  title: string;
  notes: string;
  status: string;
  kind: string;
  category: string;
  dueDate: string;
  predecessorIds: Id<"workflowItems">[];
};

type Props = {
  visible: boolean;
  workflowItemId: Id<"workflowItems"> | null;
  userId: string;
  candidateTasks: CandidateTask[];
  onClose: () => void;
};

export function WorkflowTaskEditorModal({
  visible,
  workflowItemId,
  userId,
  candidateTasks,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const updateWorkflow = useMutation(api.workflow.update);
  const removeWorkflow = useMutation(api.workflow.remove);
  const setDependencies = useMutation(api.workflow.setDependencies);

  const data = useQuery(
    api.workflow.getItemEditorState,
    visible && workflowItemId ? { id: workflowItemId, userId } : "skip"
  ) as EditorData | null | undefined;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<string>("not_started");
  const [predecessorIds, setPredecessorIds] = useState<Id<"workflowItems">[]>([]);
  const [saving, setSaving] = useState(false);
  const [hydratedId, setHydratedId] = useState<Id<"workflowItems"> | null>(null);

  useEffect(() => {
    if (!visible || !data) return;
    if (hydratedId === data._id) return;
    setHydratedId(data._id);
    setTitle(data.title);
    setNotes(data.notes ?? "");
    setDueDate(data.dueDate ?? "");
    setStatus(data.status);
    setPredecessorIds(data.predecessorIds ?? []);
  }, [data, hydratedId, visible]);

  useEffect(() => {
    if (!visible) {
      setHydratedId(null);
      setSaving(false);
    }
  }, [visible]);

  const dependencyCandidates = useMemo(
    () => candidateTasks.filter((task) => task._id !== workflowItemId),
    [candidateTasks, workflowItemId]
  );

  const toggleDependency = (taskId: Id<"workflowItems">) => {
    setPredecessorIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  };

  const handleSave = async () => {
    if (!workflowItemId || !title.trim() || saving) return;
    setSaving(true);
    try {
      await updateWorkflow({
        id: workflowItemId,
        userId,
        title: title.trim(),
        notes: notes.trim() || null,
        dueDate: dueDate.trim() || null,
        status,
      });
      await setDependencies({
        userId,
        workflowItemId,
        dependencies: predecessorIds.map((id) => ({
          predecessorWorkflowItemId: id,
          relationKind: "blocks",
        })),
      });
      onClose();
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!workflowItemId) return;
    Alert.alert(t("workflowEditor.deleteTitle"), t("workflowEditor.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("workflowEditor.deleteAction"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await removeWorkflow({ id: workflowItemId, userId });
              onClose();
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            }
          })();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[86%] rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
            {t("workflowEditor.title")}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("workflowEditor.subtitle")}
          </Text>

          {!data ? (
            <Text className="mt-6 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("elements.workflowLoading")}
            </Text>
          ) : (
            <ScrollView className="mt-5" keyboardShouldPersistTaps="handled">
              <Text className="mb-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.nameLabel")}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t("planner.addTaskPlaceholder")}
                placeholderTextColor={colors.textTertiary}
                className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              />

              <Text className="mb-2 mt-5 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.workflowStatus")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {WORKFLOW_STATUSES.map((value) => {
                  const active = status === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setStatus(value)}
                      className={`rounded-full border px-4 py-2 ${
                        active
                          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                          : "border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          active
                            ? "text-kyar-bg dark:text-kyar-dark-bg"
                            : "text-kyar-text dark:text-kyar-dark-text"
                        }`}
                      >
                        {value.replace(/_/g, " ")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="mb-2 mt-5 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("workflowEditor.dueDate")}
              </Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder={t("workflowEditor.dueDatePlaceholder")}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              />

              <Text className="mb-2 mt-5 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("elements.notesLabel")}
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("elements.notesPlaceholder")}
                placeholderTextColor={colors.textTertiary}
                multiline
                className="min-h-[108px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              />

              <Text className="mb-2 mt-5 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("workflowEditor.dependencies")}
              </Text>
              {dependencyCandidates.length === 0 ? (
                <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("workflowEditor.dependenciesEmpty")}
                </Text>
              ) : (
                <View className="gap-2">
                  {dependencyCandidates.map((task) => {
                    const active = predecessorIds.includes(task._id);
                    return (
                      <Pressable
                        key={task._id}
                        onPress={() => toggleDependency(task._id)}
                        className={`rounded-2xl border px-4 py-3 ${
                          active
                            ? "border-kyar-text bg-kyar-panelRaised dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised"
                            : "border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                        }`}
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <Text
                            className="min-w-0 flex-1 text-sm text-kyar-text dark:text-kyar-dark-text"
                            numberOfLines={2}
                          >
                            {task.title}
                          </Text>
                          <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                            {active
                              ? t("workflowEditor.dependencyOn")
                              : t("workflowEditor.dependencyOff")}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          <View className="mt-5 gap-3">
            <Button
              title={saving ? t("elements.saving") : t("common.save")}
              onPress={() => void handleSave()}
              disabled={!data || !title.trim() || saving}
            />
            <View className="flex-row gap-3">
              <Button
                title={t("common.cancel")}
                variant="secondary"
                onPress={onClose}
                className="flex-1"
                disabled={saving}
              />
              <Button
                title={t("workflowEditor.deleteAction")}
                variant="secondary"
                onPress={handleDelete}
                className="flex-1"
                disabled={!data || saving}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
