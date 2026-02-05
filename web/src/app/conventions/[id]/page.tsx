'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConvention,
  fetchPlan,
  replacePlan,
  regeneratePacking,
} from '@/lib/api/conventions';
import { fetchBuilds } from '@/lib/api/builds';
import type { DayPlanEntry } from '@kyarafit/design-system/types';

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
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const { data: convention, isLoading: loadingConv } = useQuery({
    queryKey: ['convention', id],
    queryFn: () => fetchConvention(id),
    enabled: !!id,
  });
  const { data: plan = [], isLoading: loadingPlan } = useQuery({
    queryKey: ['convention-plan', id],
    queryFn: () => fetchPlan(id),
    enabled: !!id,
  });
  const { data: builds = [] } = useQuery({
    queryKey: ['builds'],
    queryFn: fetchBuilds,
  });

  const replacePlanMutation = useMutation({
    mutationFn: (newPlan: DayPlanEntry[]) => replacePlan(id, newPlan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convention-plan', id] });
      setPickerDate(null);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regeneratePacking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['convention-packing', id] });
      router.push(`/conventions/${id}/packing`);
    },
  });

  const dates = useMemo(
    () => (convention ? dateRange(convention.startDate, convention.endDate) : []),
    [convention]
  );
  const planByDate = useMemo(() => new Map(plan.map((e) => [e.date, e])), [plan]);

  const handleAssign = useCallback(
    (date: string, buildId: string | null) => {
      const newPlan: DayPlanEntry[] = dates.map((d) => {
        const existing = planByDate.get(d);
        return {
          date: d,
          buildId: d === date ? buildId : (existing?.buildId ?? null),
          notes: existing?.notes,
        };
      });
      replacePlanMutation.mutate(newPlan);
    },
    [dates, planByDate, replacePlanMutation]
  );

  if (loadingConv) {
    return (
      <div className="min-h-screen flex flex-col pb-32 px-6 pt-12">
        <p className="meta-label">Loading…</p>
      </div>
    );
  }
  if (!convention) {
    return (
      <div className="min-h-screen flex flex-col pb-32 px-6 pt-12">
        <p className="meta-label">Convention not found.</p>
        <Link href="/conventions" className="mt-4 text-sm underline">Back to Conventions</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href="/conventions" className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <p className="meta-label">Convention</p>
      </header>

      <main className="flex-1 px-6 py-8">
        <h1 className="font-serif text-3xl font-bold italic">{convention.name}</h1>
        <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary mt-2">
          {convention.startDate} – {convention.endDate}
          {convention.location ? ` · ${convention.location}` : ''}
        </p>

        <p className="meta-label mt-8 mb-4">DAY-BY-DAY PLAN</p>
        {loadingPlan && <p className="meta-label">Loading plan…</p>}
        <ul className="space-y-0 border-b border-kyar-borderSubtle">
          {dates.map((date) => {
            const entry = planByDate.get(date);
            const buildName = entry?.buildId
              ? builds.find((b) => b.id === entry.buildId)?.name ?? '—'
              : 'Rest day';
            return (
              <li key={date}>
                <button
                  type="button"
                  onClick={() => setPickerDate(date)}
                  className="w-full flex items-center gap-3 py-4 border-t border-kyar-borderSubtle text-left hover:opacity-80"
                >
                  <span className="text-sm w-24">{date}</span>
                  <span className="flex-1 font-serif italic font-bold">{buildName}</span>
                  <span className="material-symbols-outlined text-kyar-textTertiary">chevron_right</span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
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
          <div
            className="bg-white w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-lg italic font-bold mb-4">Assign build for {pickerDate}</h2>
            <button
              type="button"
              onClick={() => handleAssign(pickerDate, null)}
              className="block w-full text-left py-3 border-b border-kyar-borderSubtle text-sm"
            >
              Rest day
            </button>
            {builds.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleAssign(pickerDate, b.id)}
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
    </div>
  );
}
