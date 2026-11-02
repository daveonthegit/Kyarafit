"use client";

interface ChecklistRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  code?: string;
}

/**
 * Packing/checklist row (ref 8a): square light checkbox, sentence-case 13px
 * label (content is never meta — QA-4), strike-through + 55% when checked,
 * mono trailing code.
 */
export function ChecklistRow({ label, checked, onToggle, code }: ChecklistRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-2.5 min-h-[44px] text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
    >
      <span
        className={`flex-shrink-0 w-4 h-4 border flex items-center justify-center rounded-sm ${
          checked ? "bg-glass-solid border-glass-solid" : "bg-transparent border-media-fg-45"
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-glass-ink" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
      <span
        className={`flex-1 text-[13px] ${
          checked ? "line-through text-media-fg-55" : "text-kyar-media-fg"
        }`}
      >
        {label}
      </span>
      {code && <span className="font-explorer-mono text-[10px] text-media-fg-55">{code}</span>}
    </button>
  );
}
