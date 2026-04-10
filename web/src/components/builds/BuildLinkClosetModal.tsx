"use client";

import { useRef, useState } from "react";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import {
  LinkClosetItemsForm,
  type LinkClosetItemsFormHandle,
  type LinkClosetRow,
} from "@/components/builds/LinkClosetItemsForm";
import type { Id } from "convex/_generated/dataModel";

type ClosetEntityId = Id<"closetItems"> | Id<"cosplayNodes">;

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
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-w-[100px] px-4 py-2.5 border border-kyar-border text-xs font-semibold uppercase tracking-wider text-kyar-text hover:border-kyar-text rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-w-[100px] bg-kyar-text text-kyar-bg py-2.5 text-xs font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
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
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </BuildDetailModalShell>
  );
}
