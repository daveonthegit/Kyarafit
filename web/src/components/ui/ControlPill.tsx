"use client";

export function ControlPill({
  label,
  onClick,
  "aria-label": ariaLabel,
}: {
  label: string;
  onClick: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-surface px-4 text-xs font-medium text-kyar-text transition-colors hover:border-kyar-text hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
    >
      {label}
    </button>
  );
}
