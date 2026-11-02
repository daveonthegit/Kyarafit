"use client";

import { useRef, useState } from "react";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import {
  LinkClosetItemsForm,
  type LinkClosetItemsFormHandle,
  type LinkClosetRow,
} from "@/components/builds/LinkClosetItemsForm";
import { PhotoPill } from "@/components/ui/PhotoPill";
import type { Id } from "convex/_generated/dataModel";

type ClosetEntityId = Id<"cosplayNodes">;

type BuildLinkClosetModalProps = {
  open: boolean;
  onClose: () => void;
  buildId: Id<"builds">;
  userId: string;
  closetItems: LinkClosetRow[];
  linkedIds: ClosetEntityId[];
};

export function BuildLinkClosetModal({
  open,
  onClose,
  buildId,
  userId,
  closetItems,
  linkedIds,
}: BuildLinkClosetModalProps) {
  const formRef = useRef<LinkClosetItemsFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await formRef.current?.save();
    } catch {
      setError("Could not save links. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BuildDetailModalShell
      open={open}
      onClose={onClose}
      title="Link elements and materials"
      titleId="link-closet-modal-title"
      size="2xl"
      closeDisabled={saving}
      footer={
        <>
          <PhotoPill
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="min-w-[100px] flex-1 sm:flex-none"
          >
            Cancel
          </PhotoPill>
          <PhotoPill
            type="button"
            variant="solid"
            onClick={handleSave}
            disabled={saving}
            className="min-w-[100px] flex-1 sm:flex-none"
          >
            {saving ? "Saving…" : "Save"}
          </PhotoPill>
        </>
      }
    >
      <LinkClosetItemsForm
        ref={formRef}
        buildId={buildId}
        userId={userId}
        closetItems={closetItems}
        linkedIds={linkedIds}
        isActive={open}
        enableDragDrop={false}
        allowCreate
        onAfterSave={onClose}
        onError={(msg) => setError(msg)}
      />
      {error && (
        <p className="mt-3 text-sm text-on-glass-danger" role="alert">
          {error}
        </p>
      )}
    </BuildDetailModalShell>
  );
}
