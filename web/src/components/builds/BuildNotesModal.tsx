"use client";

import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";

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
            onClick={onSave}
            disabled={saving}
            className="flex-1 min-w-[100px] bg-kyar-text text-kyar-bg py-2.5 text-xs font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={saving || !notes.trim()}
            className="px-4 py-2.5 border border-kyar-border text-xs font-semibold uppercase tracking-wider text-kyar-text hover:border-kyar-text rounded-md disabled:opacity-50"
          >
            Clear notes
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-kyar-border text-xs font-semibold uppercase tracking-wider text-kyar-text hover:border-kyar-text rounded-md disabled:opacity-50"
          >
            Cancel
          </button>
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
        className="w-full min-h-[200px] border border-kyar-border rounded-md p-3 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:ring-2 focus:ring-kyar-accent/30 focus:border-kyar-accent resize-y"
        disabled={saving}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </BuildDetailModalShell>
  );
}
