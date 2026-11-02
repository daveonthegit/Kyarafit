"use client";

interface ControlPillProps {
  label: string;
  onClick: () => void;
  /** "glass" = on-photo chip: solid light when active, glass outline when not */
  surface?: "default" | "glass";
  /** Glass surface only: active segment = solid light with ink text (QA-3 exempt control state) */
  active?: boolean;
  "aria-label"?: string;
}

const glassClasses = {
  active: "bg-glass-solid text-glass-ink border border-transparent",
  inactive:
    "border border-glass-border-strong text-kyar-media-fg opacity-60 backdrop-blur-glass-chip hover:opacity-90",
};

export function ControlPill({
  label,
  onClick,
  surface = "default",
  active = false,
  "aria-label": ariaLabel,
}: ControlPillProps) {
  const base =
    "inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent";
  const styling =
    surface === "glass"
      ? `px-5 text-[10px] font-bold uppercase tracking-[0.16em] ${
          active ? glassClasses.active : glassClasses.inactive
        }`
      : "px-4 border border-kyar-borderSubtle bg-kyar-surface text-xs font-medium text-kyar-text hover:border-kyar-text hover:opacity-95";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={surface === "glass" ? active : undefined}
      className={`${base} ${styling}`}
    >
      {label}
    </button>
  );
}
