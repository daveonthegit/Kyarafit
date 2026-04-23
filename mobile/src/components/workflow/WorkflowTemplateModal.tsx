import { useEffect } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { Button } from "@/ui";

type TemplateAttachment = {
  entityType: string;
  entityId: string;
  role?: string;
  buildContextId?: Id<"builds">;
};

type WorkflowTemplate = {
  _id: Id<"workflowTemplates">;
  name: string;
  description?: string | null;
  category?: string | null;
  isBuiltIn?: boolean;
};

type Props = {
  visible: boolean;
  userId: string;
  attachments: TemplateAttachment[];
  scopeKind: "shared" | "build_specific";
  buildContextId?: Id<"builds">;
  onClose: () => void;
};

export function WorkflowTemplateModal({
  visible,
  userId,
  attachments,
  scopeKind,
  buildContextId,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const templates = useQuery(api.workflow.listTemplates, visible ? { userId } : "skip") as
    | WorkflowTemplate[]
    | undefined;
  const seedBuiltinTemplates = useMutation(api.workflow.seedBuiltinTemplates);
  const applyTemplate = useMutation(api.workflow.applyTemplate);

  useEffect(() => {
    if (!visible) return;
    void seedBuiltinTemplates({});
  }, [seedBuiltinTemplates, visible]);

  const handleApply = async (templateId: Id<"workflowTemplates">) => {
    try {
      await applyTemplate({
        userId,
        templateId,
        attachments,
        buildContextId,
        scopeKind,
      });
      onClose();
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[80%] rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
            {t("workflowTemplates.title")}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("workflowTemplates.subtitle")}
          </Text>

          <ScrollView className="mt-5">
            {templates === undefined ? (
              <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("elements.workflowLoading")}
              </Text>
            ) : templates.length === 0 ? (
              <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("workflowTemplates.empty")}
              </Text>
            ) : (
              <View className="gap-3">
                {templates.map((template) => (
                  <View
                    key={template._id}
                    className="rounded-3xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                          {template.name}
                        </Text>
                        {template.description ? (
                          <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                            {template.description}
                          </Text>
                        ) : null}
                        <Text className="mt-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                          {template.category || t("workflowTemplates.general")}
                          {template.isBuiltIn ? ` · ${t("workflowTemplates.builtIn")}` : ""}
                        </Text>
                      </View>
                      <Button
                        title={t("workflowTemplates.apply")}
                        onPress={() => void handleApply(template._id)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <Button
            title={t("common.cancel")}
            variant="secondary"
            onPress={onClose}
            className="mt-5"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
