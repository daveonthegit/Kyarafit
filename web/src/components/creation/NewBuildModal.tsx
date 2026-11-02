"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOfflineMutation } from "@/lib/offline";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  CreationFooter,
  GlassSegmented,
  GlassTextField,
  glassHintClass,
} from "@/components/creation/CreationFields";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

const STATUSES: BuildStatus[] = ["idea", "wip", "ready", "archived"];

type NewBuildModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
};

export function NewBuildModal({ onDismiss, onSuccessComplete }: NewBuildModalProps) {
  const router = useRouter();
  const t = useTranslations("Creation");
  const { userId } = useCurrentUser();
  const createBuild = useOfflineMutation(api.builds.create);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<BuildStatus>("idea");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [budgetCents, setBudgetCents] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const hasImage = imageStorageId != null || imageUrl.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId || (!imageStorageId && !imageUrl.trim())) return;
    setIsPending(true);
    try {
      const build = await createBuild({
        userId,
        name: name.trim(),
        status,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: imageUrl.trim() || undefined,
        budgetCents: budgetCents.trim() ? Math.round(parseFloat(budgetCents) * 100) : undefined,
      });
      if (build) {
        onSuccessComplete();
        router.push(`/build-detail/${build._id}`);
      }
    } catch {
      // The write layer reports persistence failures; keep the form open for retry.
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AdaptiveModal
      open
      onClose={onDismiss}
      title={t("newBuildTitle")}
      titleId="global-new-build-modal-title"
      size="md"
      closeDisabled={isPending}
      closeLabel={t("close")}
      footer={(close) => (
        <CreationFooter
          onCancel={close}
          cancelLabel={t("cancel")}
          cancelDisabled={isPending}
          formId="new-build-modal-form"
          submitLabel={isPending ? t("creating") : t("createBuild")}
          submitDisabled={isPending || !name.trim() || !hasImage}
        />
      )}
    >
      <form id="new-build-modal-form" onSubmit={submit} className="space-y-[18px]">
        <p className="text-[13px] text-media-fg-70">{t("newBuildIntro")}</p>
        <div>
          <ImageUpload
            surface="glass"
            label={t("cover")}
            category="builds"
            onImageSelected={(result) => {
              if ("imageStorageId" in result && result.imageStorageId) {
                setImageStorageId(result.imageStorageId);
                setImageUrl("");
              } else {
                setImageUrl(result.imageUrl ?? "");
                setImageStorageId(null);
              }
            }}
            currentImage={imageUrl || undefined}
            currentStorageId={imageStorageId ?? undefined}
            aside={
              <>
                <GlassTextField
                  label={t("name")}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("buildNamePlaceholder")}
                />
                <GlassTextField
                  label={t("budgetLabel")}
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetCents}
                  onChange={(e) => setBudgetCents(e.target.value)}
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </>
            }
          />
          {!hasImage && <p className={glassHintClass}>{t("imageRequiredHint")}</p>}
        </div>
        <GlassSegmented
          label={t("status")}
          options={STATUSES.map((s) => ({ value: s, label: t(`buildStatus_${s}`) }))}
          value={status}
          onChange={setStatus}
        />
      </form>
    </AdaptiveModal>
  );
}
