"use client";

import { useState } from "react";
import { ChecklistRow } from "@/components/ui/ChecklistRow";

export type PackingItem = {
  _id: string;
  label: string;
  checked: boolean;
  date?: string;
  notes?: string;
  closetItemId?: string;
};

type Props = {
  item: PackingItem;
  isManual: boolean;
  userId: string | null;
  onToggle: () => void;
  onUpdate: (patch: { date?: string; notes?: string }) => void;
  onDelete?: () => void;
};

export function PackingItemRow({ item, isManual, userId, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(item.date ?? "");
  const [editNotes, setEditNotes] = useState(item.notes ?? "");

  const handleSave = () => {
    onUpdate({
      date: editDate.trim() || "",
      notes: editNotes.trim() || "",
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditDate(item.date ?? "");
    setEditNotes(item.notes ?? "");
    setEditing(false);
  };

  return (
    <div className="border-b border-glass-divider last:border-0">
      <div className="flex items-center gap-2">
        <ChecklistRow label={item.label} checked={item.checked} onToggle={onToggle} />
        {isManual && (
          <>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-shrink-0 p-1 text-media-fg-55 hover:text-kyar-media-fg"
                aria-label="Edit date and notes"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
            ) : null}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="flex-shrink-0 p-1 text-media-fg-55 hover:text-on-glass-danger"
                aria-label={`Remove ${item.label}`}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </>
        )}
      </div>
      {isManual && (item.date || item.notes) && !editing && (
        <div className="ml-7 mb-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-media-fg-55">
          {item.date && <span>Date: {item.date}</span>}
          {item.notes && <span className="min-w-0 truncate">Note: {item.notes}</span>}
        </div>
      )}
      {isManual && editing && userId && (
        <div className="ml-7 mb-2 mt-1 space-y-2 rounded-[10px] border border-glass-border bg-glass-active p-2">
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-media-fg-55">Date</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="glass-field mt-0.5 block w-full px-2 py-1.5 text-sm [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-media-fg-55">
              Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="glass-field mt-0.5 block w-full resize-y px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-glass-solid px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-glass-border-strong bg-glass-bar px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] hover:bg-glass-active"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
