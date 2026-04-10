"use client";

interface ChecklistRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  code?: string;
}

export function ChecklistRow({ label, checked, onToggle, code }: ChecklistRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 rounded-sm"
    >
      <span
        className={`flex-shrink-0 w-4 h-4 border border-kyar-text flex items-center justify-center rounded-sm ${
          checked ? "bg-kyar-text" : "bg-transparent"
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-kyar-bg" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
      <span
        className={`flex-1 text-[13px] font-sans-wide font-semibold uppercase tracking-wide ${
          checked ? "opacity-60 line-through" : "text-kyar-text"
        }`}
      >
        {label}
      </span>
      {code && <span className="text-[10px] text-kyar-textTertiary">{code}</span>}
    </button>
  );
}
