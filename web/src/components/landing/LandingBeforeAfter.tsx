"use client";

import { useEffect, useRef, useState } from "react";
import { observeReveal, prefersReducedMotion } from "@/components/landing/landingMotion";
import { LANDING_BUILD_TASKS } from "@/data/landingMock";

/**
 * S2 · Retire the spreadsheet — before/after split (Landing Live spec).
 * Left: studio wall with a tilted, decaying `.xlsx` mock. Right: build photo
 * with ONE glass task panel that self-plays once on first intersection —
 * two rows check off in sequence and the progress hairline counts 52→60→68%.
 * Under reduced motion the demo shows its end state immediately.
 */

const DEMO_STEPS = [52, 60, 68] as const;

const SPREADSHEET_ROWS: Array<[string, string, string]> = [
  ["A4", "Wig — style + cut", "??"],
  ["A5", "Armor base coat", "done?"],
  ["A6", "Order contact lenses", "#REF!"],
  ["A7", "DO NOT FORGET BADGE", ""],
  ["A8", "hem underskirt", "v2_FINAL"],
];

export function LandingBeforeAfter() {
  const sectionRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef(false);
  // Demo state: how many of the first two open tasks have checked in.
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState<number>(DEMO_STEPS[0]);

  useEffect(() => {
    observeReveal(leftRef.current);
    observeReveal(rightRef.current);

    const el = sectionRef.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setStep(2);
      setPct(DEMO_STEPS[2]);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || playedRef.current) return;
        playedRef.current = true;
        io.disconnect();
        // Two rows check in sequence; the % readout counts up with them.
        setTimeout(() => {
          setStep(1);
          setPct(DEMO_STEPS[1]);
        }, 900);
        setTimeout(() => {
          setStep(2);
          setPct(DEMO_STEPS[2]);
        }, 1900);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const tasks = LANDING_BUILD_TASKS;

  return (
    <section
      ref={sectionRef}
      className="relative grid min-h-[90svh] grid-rows-[auto_auto] lg:grid-cols-2 lg:grid-rows-1 text-kyar-media-fg"
      aria-label="Retire the spreadsheet"
    >
      {/* Before — studio wall + decaying spreadsheet */}
      <div className="relative overflow-hidden bg-studio-wall">
        <div
          ref={leftRef}
          className="landing-reveal relative mx-auto flex h-full max-w-[560px] flex-col justify-center px-6 py-16 sm:px-10 lg:py-24"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.28em] opacity-55 mb-4">
            Before
          </span>
          <h2 className="font-serif italic font-normal text-[38px] sm:text-[52px] leading-[0.98] tracking-[-0.02em]">
            Retire the spreadsheet.
          </h2>
          <p className="mt-5 max-w-[400px] text-[15px] leading-relaxed text-media-fg-70">
            The plan for a hand-made build deserves better than a tab named
            &ldquo;cosplay_v2_FINAL&rdquo; — broken references, forgotten rows, and no photos of the
            work itself.
          </p>

          {/* Tilted .xlsx mock — deliberately paper-cream: it is the "before" */}
          <div
            className="mt-10 w-full max-w-[420px] -rotate-2 rounded-md bg-[#f4efe4] p-4 text-[#3b3a33] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]"
            aria-hidden
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#d8d2c0] pb-2">
              <span className="font-explorer-mono text-[11px] font-bold">
                cosplay_plan_v2_FINAL.xlsx
              </span>
              <span className="font-explorer-mono text-[9px] uppercase tracking-[0.14em] opacity-50">
                Last edit: 4 mo ago
              </span>
            </div>
            <table className="w-full font-explorer-mono text-[11px]">
              <tbody>
                {SPREADSHEET_ROWS.map(([cell, label, status]) => (
                  <tr key={cell} className="border-b border-[#e6e0cf] last:border-0">
                    <td className="w-8 py-1.5 pr-2 opacity-40">{cell}</td>
                    <td className="py-1.5 pr-2">{label}</td>
                    <td
                      className={`py-1.5 text-right ${
                        status === "#REF!" || label.startsWith("DO NOT")
                          ? "font-bold text-[#c2402a]"
                          : "opacity-60"
                      }`}
                    >
                      {status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* After — build photo + ONE glass task panel */}
      <div className="relative overflow-hidden">
        <img
          src="/mock/builds/Hutao.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-scrim-page-vertical" aria-hidden />
        <div
          ref={rightRef}
          className="landing-reveal relative mx-auto flex h-full max-w-[560px] flex-col justify-center px-6 py-16 sm:px-10 lg:py-24"
          style={{ transitionDelay: "120ms" }}
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-4">
            After
          </span>

          <div className="w-full max-w-[420px] rounded-glass border border-glass-border bg-glass backdrop-blur-glass">
            <div className="flex items-baseline justify-between gap-4 border-b border-glass-divider-strong px-5 py-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                Raiden Shogun · Tasks
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] tabular-nums opacity-70">
                {pct}%
              </span>
            </div>
            <div className="px-5 pt-3">
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-glass-border">
                <div
                  className="h-full rounded-full bg-kyar-media-fg transition-[width] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <ul className="px-2 py-2">
              {tasks.map((task, index) => {
                // Demo state: one row starts done, the next two check in
                // sequence as the demo plays, the last stays open (Due Fri).
                const demoChecked = index < 1 + step;
                const isDueRow = index === tasks.length - 1 && !demoChecked;
                return (
                  <li
                    key={task.label}
                    className="flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2"
                  >
                    <span
                      className={`flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                        demoChecked ? "border-glass-solid bg-glass-solid" : "border-media-fg-45"
                      }`}
                      aria-hidden
                    >
                      {demoChecked && (
                        <svg
                          className="h-3 w-3 text-glass-ink"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`flex-1 text-[13px] transition-all duration-300 ${
                        demoChecked ? "text-media-fg-55 line-through" : ""
                      }`}
                    >
                      {task.label}
                    </span>
                    {isDueRow && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-danger">
                        Due Fri
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-6 max-w-[400px] text-[15px] leading-relaxed text-media-fg-70">
            One panel per build: elements, tasks, and due dates over the photos of the work — and it
            all keeps working at the con with no signal.
          </p>
        </div>
      </div>
    </section>
  );
}
