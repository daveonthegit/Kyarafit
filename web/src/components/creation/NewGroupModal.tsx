"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { can } from "@kyarafit/design-system/domain/entitlements";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { CreationFooter, GroupFields, glassErrorClass } from "@/components/creation/CreationFields";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFeatureAccess } from "@/lib/api/useTier";
import { api } from "convex/_generated/api";

type NewGroupModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
};

export function NewGroupModal({ onDismiss, onSuccessComplete }: NewGroupModalProps) {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { tier } = useFeatureAccess();
  const t = useTranslations("Social");
  const tc = useTranslations("Creation");
  // REQ-019: creating a group is paid (joining/participating stays free).
  const canCreateGroup = can(tier, "group_create");
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim() || !canCreateGroup) return;
    setError(null);
    setPending(true);
    try {
      const group = await createGroup({
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      if (group?._id) {
        onSuccessComplete();
        router.push(`/g/${group._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("failedToCreateGroup"));
    } finally {
      setPending(false);
    }
  };

  if (!canCreateGroup) {
    return (
      <AdaptiveModal
        open
        onClose={onDismiss}
        title={tc("newGroupTitle")}
        titleId="global-new-group-modal-title"
        size="md"
        closeLabel={tc("close")}
      >
        <UpgradePrompt
          surface="glass"
          message={t("groupCreatePaidMessage")}
          linkText={t("viewPlan")}
        />
      </AdaptiveModal>
    );
  }

  return (
    <AdaptiveModal
      open
      onClose={onDismiss}
      title={tc("newGroupTitle")}
      titleId="global-new-group-modal-title"
      size="md"
      closeDisabled={pending}
      closeLabel={tc("close")}
      footer={(close) => (
        <CreationFooter
          onCancel={close}
          cancelLabel={tc("cancel")}
          cancelDisabled={pending}
          formId="new-group-modal-form"
          submitLabel={pending ? tc("creating") : tc("createGroup")}
          submitDisabled={pending || !name.trim()}
        />
      )}
    >
      <form id="new-group-modal-form" onSubmit={handleSubmit} className="space-y-[18px]">
        <GroupFields
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          visibility={visibility}
          onVisibilityChange={setVisibility}
          labels={{
            name: tc("name"),
            namePlaceholder: tc("groupNamePlaceholder"),
            description: tc("descriptionLabel"),
            descriptionPlaceholder: tc("groupDescriptionPlaceholder"),
            visibility: tc("visibilityLabel"),
            private: tc("visibility_private"),
            public: tc("visibility_public"),
            visibilityHint: tc("visibilityHint"),
          }}
        />
        {error && (
          <p className={glassErrorClass} role="alert">
            {error}
          </p>
        )}
      </form>
    </AdaptiveModal>
  );
}
