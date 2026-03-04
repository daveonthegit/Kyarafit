"use client";

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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notes-modal-title"
    >
      <div className="bg-white max-w-2xl w-full max-h-[85vh] flex flex-col rounded shadow-lg">
        <div className="flex items-center justify-between border-b border-kyar-border px-4 py-3">
          <h2 id="notes-modal-title" className="font-serif text-lg italic font-bold">
            Notes
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:opacity-70"
            aria-label="Close notes"
            disabled={saving}
          >
            <span className="material-symbols-outlined font-light text-xl">close</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 p-4 overflow-auto">
          <label htmlFor="build-notes-textarea" className="sr-only">
            Build notes
          </label>
          <textarea
            id="build-notes-textarea"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add notes, references, or process details for this build…"
            className="w-full min-h-[200px] border border-kyar-border p-3 text-sm placeholder:text-kyar-textTertiary focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black resize-y"
            disabled={saving}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-kyar-border px-4 py-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 min-w-[100px] bg-black text-white py-2.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={saving || !notes.trim()}
            className="px-4 py-2.5 border border-kyar-border text-[11px] font-semibold uppercase tracking-wider hover:border-black disabled:opacity-50"
          >
            Clear notes
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-kyar-border text-[11px] font-semibold uppercase tracking-wider hover:border-black disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
