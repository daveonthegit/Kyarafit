"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { ImageUpload } from "@/components/ui/ImageUpload";
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
  const { userId } = useCurrentUser();
  const createBuild = useMutation(api.builds.create);
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
        router.push(`/build-detail?id=${build._id}`);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <BuildDetailModalShell
      open
      onClose={onDismiss}
      title="New build"
      titleId="global-new-build-modal-title"
      size="lg"
      closeDisabled={isPending}
      zOverlayClass="z-[10100]"
      footer={
        <button
          type="submit"
          form="new-build-modal-form"
          disabled={isPending || !name.trim() || !hasImage}
          className="w-full bg-kyar-text py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create build"}
        </button>
      }
    >
      <form id="new-build-modal-form" onSubmit={submit} className="space-y-5">
        <p className="text-sm text-kyar-textSecondary">
          Add a cover image and name. You can edit details later.
        </p>
        <div>
          <label className="mb-2 block meta-label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arlecchino"
            className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:border-kyar-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block meta-label">Image (required)</label>
          <ImageUpload
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
          />
          {!hasImage && (
            <p className="mt-2 text-xs text-kyar-textTertiary">
              An image is required to create a build.
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block meta-label">Budget $ (optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budgetCents}
            onChange={(e) => setBudgetCents(e.target.value)}
            placeholder="0.00"
            className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:border-kyar-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block meta-label">Status</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                  status === s
                    ? "border-black bg-kyar-muted text-black"
                    : "border-kyar-border text-kyar-textTertiary hover:border-black"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </form>
    </BuildDetailModalShell>
  );
}
