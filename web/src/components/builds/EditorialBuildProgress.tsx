"use client";

/** Donut chart for task completion 0–100 (editorial / Stitch-style). */
export function EditorialProgressDonut({
  progress,
  showFlankLabels = false,
}: {
  progress: number;
  /** Small done / remaining labels beside the ring (Stitch mock). */
  showFlankLabels?: boolean;
}) {
  const p = Math.min(100, Math.max(0, progress));
  const r = 15.9155;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  const remainder = 100 - p;
  const donut = (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          className="stroke-kyar-borderSubtle"
          strokeWidth="2.2"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          className="stroke-kyar-text"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="font-serif text-2xl font-semibold text-kyar-text leading-none tabular-nums">
          {p}%
        </span>
      </div>
    </div>
  );

  if (!showFlankLabels) return donut;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <span className="text-[10px] tabular-nums text-kyar-textTertiary w-7 text-right shrink-0">
        {p}%
      </span>
      {donut}
      <span className="text-[10px] tabular-nums text-kyar-textTertiary w-7 shrink-0">{remainder}%</span>
    </div>
  );
}

/** Vertical bar + label (Stitch “Project progress” rail). */
export function EditorialVerticalProgressRail({ progress }: { progress: number }) {
  const p = Math.min(100, Math.max(0, progress));
  return (
    <div className="flex gap-4 items-stretch">
      <span
        className="text-[9px] uppercase tracking-[0.25em] text-kyar-textTertiary select-none"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        Project progress
      </span>
      <div className="w-1 h-32 shrink-0 bg-kyar-borderSubtle rounded-full relative overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 bg-kyar-text rounded-full transition-all duration-500"
          style={{ height: `${p}%` }}
        />
      </div>
    </div>
  );
}

/** Horizontal bar + label */
export function EditorialHorizontalProgressRail({ progress }: { progress: number }) {
  const p = Math.min(100, Math.max(0, progress));
  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-[9px] uppercase tracking-[0.25em] text-kyar-textTertiary select-none">
        Project progress
      </span>
      <div className="h-1 w-full shrink-0 bg-kyar-borderSubtle rounded-full relative overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-0 bg-kyar-text rounded-full transition-all duration-500"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

