"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start);
  const endD = new Date(end);
  while (d <= endD) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function ConventionDetailPage() {
  const params = useParams();
  const id = params.id as Id<"conventions">;
  const router = useRouter();
  const { userId } = useCurrentUser();
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const convention = useQuery(api.conventions.get, id ? { id } : "skip");
  const plan = useQuery(api.conventions.getPlan, id ? { conventionId: id } : "skip") ?? [];
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const replacePlanMut = useMutation(api.conventions.replacePlan);
  const regeneratePackingMut = useMutation(api.conventions.regeneratePacking);

  const dates = useMemo(
    () => (convention ? dateRange(convention.startDate, convention.endDate) : []),
    [convention]
  );
  const planByDate = useMemo(() => new Map(plan.map((e) => [e.date, e])), [plan]);

  const handleAssign = useCallback(
    (date: string, buildId: string | null) => {
      if (!userId) return;
      const newPlan = dates.map((d) => {
        const existing = planByDate.get(d);
        return {
          date: d,
          buildId:
            d === date
              ? buildId
                ? (buildId as Id<"builds">)
                : undefined
              : (existing?.buildId ?? undefined),
          notes: existing?.notes,
        };
      });
      replacePlanMut({ userId, conventionId: id, plan: newPlan });
      setPickerDate(null);
    },
    [dates, planByDate, replacePlanMut, userId, id]
  );

  const handleRegenerate = async () => {
    if (!userId) return;
    await regeneratePackingMut({ userId, conventionId: id });
    router.push(`/conventions/${id}/packing`);
  };

  if (convention === undefined) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Loading...</p>
      </WebAppShell>
    );
  }
  if (!convention) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Convention not found.</p>
        <Link href="/conventions" className="mt-4 text-sm underline">
          Back to Conventions
        </Link>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href="/conventions" className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <p className="meta-label">Convention</p>
      </header>

      <main className="flex-1 py-8">
        <h1 className="font-serif text-3xl font-bold italic">{convention.name}</h1>
        <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary mt-2">
          {convention.startDate} – {convention.endDate}
          {convention.location ? ` · ${convention.location}` : ""}
        </p>

        <p className="meta-label mt-8 mb-4">DAY-BY-DAY PLAN</p>
        <ul className="space-y-0 border-b border-kyar-borderSubtle">
          {dates.map((date) => {
            const entry = planByDate.get(date);
            const buildName = entry?.buildId
              ? (builds.find((b) => b._id === entry.buildId)?.name ?? "—")
              : "Rest day";
            return (
              <li key={date}>
                <button
                  type="button"
                  onClick={() => setPickerDate(date)}
                  className="w-full flex items-center gap-3 py-4 border-t border-kyar-borderSubtle text-left hover:opacity-80"
                >
                  <span className="text-sm w-24">{date}</span>
                  <span className="flex-1 font-serif italic font-bold">{buildName}</span>
                  <span className="material-symbols-outlined text-kyar-textTertiary">
                    chevron_right
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={handleRegenerate}
          className="w-full bg-black text-white py-3.5 text-[11px] font-bold uppercase tracking-wider mt-8 disabled:opacity-50"
        >
          GENERATE PACKING LIST
        </button>
        <Link
          href={`/conventions/${id}/packing`}
          className="block w-full border border-black text-center py-3.5 text-[11px] font-bold uppercase tracking-wider mt-3"
        >
          VIEW PACKING LIST
        </Link>
      </main>

      {pickerDate !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6"
          onClick={() => setPickerDate(null)}
        >
          <div className="bg-white w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-lg italic font-bold mb-4">
              Assign build for {pickerDate}
            </h2>
            <button
              type="button"
              onClick={() => handleAssign(pickerDate, null)}
              className="block w-full text-left py-3 border-b border-kyar-borderSubtle text-sm"
            >
              Rest day
            </button>
            {builds.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => handleAssign(pickerDate, b._id)}
                className="block w-full text-left py-3 border-b border-kyar-borderSubtle text-sm"
              >
                {b.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPickerDate(null)}
              className="mt-4 w-full text-center meta-label"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </WebAppShell>
  );
}
