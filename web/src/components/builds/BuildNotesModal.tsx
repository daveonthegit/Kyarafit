"use client";

import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { PhotoPill } from "@/components/ui/PhotoPill";

export interface BuildNotesModalProps {
  open: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}

export function BuildNotesModal({
  open,
  notes,
  onNotesChange,
  onSave,
  onClear,
  onClose,
  saving,
  error,
}: BuildNotesModalProps) {
  return (
    <BuildDetailModalShell
      open={open}
      onClose={onClose}
      title="Notes"
      titleId="notes-modal-title"
      size="xl"
      closeDisabled={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClear}
            disabled={saving || !notes.trim()}
            className="mr-auto min-h-[44px] px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 underline decoration-glass-border-strong underline-offset-4 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-25"
          >
            Clear notes
          </button>
          <PhotoPill type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </PhotoPill>
          <PhotoPill type="button" variant="solid" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </PhotoPill>
        </>
      }
    >
      <label htmlFor="build-notes-textarea" className="sr-only">
        Build notes
      </label>
      <textarea
        id="build-notes-textarea"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Add notes, references, or process details for this build…"
        className="glass-field min-h-[200px] w-full resize-y p-3 text-sm leading-relaxed"
        disabled={saving}
      />
      {error && (
        <p className="mt-2 text-sm text-on-glass-danger" role="alert">
          {error}
        </p>
      )}
    </BuildDetailModalShell>
  );
}
