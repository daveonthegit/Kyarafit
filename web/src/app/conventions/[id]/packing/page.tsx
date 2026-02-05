"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchConvention,
  fetchPacking,
  updatePackingItem,
  regeneratePacking,
} from "@/lib/api/conventions";
import { ChecklistRow } from "@/components/ui/ChecklistRow";

export default function ConventionPackingPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: convention } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => fetchConvention(id),
    enabled: !!id,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["convention-packing", id],
    queryFn: () => fetchPacking(id),
    enabled: !!id,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      updatePackingItem(itemId, { checked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convention-packing", id] });
    },
  });

  const regenerate = useMutation({
    mutationFn: () => regeneratePacking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convention-packing", id] });
    },
  });

  const general = items.filter((i) => !i.date && !i.buildId);
  const byDate = new Map<string, typeof items>();
  for (const i of items.filter((i) => i.date || i.buildId)) {
    const key = i.date ?? "general";
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(i);
  }
  const dateKeys = Array.from(byDate.keys()).sort();

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href={`/conventions/${id}`} className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <div>
          <p className="meta-label">Packing</p>
          <h1 className="font-serif text-2xl font-bold italic">{convention?.name ?? "…"}</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <button
          type="button"
          onClick={() => regenerate.mutate()}
          disabled={regenerate.isPending}
          className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider mb-8 disabled:opacity-50"
        >
          REGENERATE LIST
        </button>

        {items.length === 0 && !regenerate.isPending && (
          <p className="text-sm text-kyar-meta">
            No packing list yet. Generate one from the convention plan.
          </p>
        )}

        {general.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif text-xl font-bold italic border-b border-black pb-2 mb-6">
              GENERAL ESSENTIALS
            </h2>
            <div className="space-y-1">
              {general.map((item) => (
                <ChecklistRow
                  key={item.id}
                  label={item.label}
                  checked={item.checked}
                  onToggle={() => updateItem.mutate({ itemId: item.id, checked: !item.checked })}
                />
              ))}
            </div>
          </section>
        )}

        {dateKeys.map((key) => {
          const list = byDate.get(key)!;
          const heading = list[0]?.date ?? key;
          return (
            <section key={key} className="mb-10">
              <h2 className="font-serif text-xl font-bold italic border-b border-black pb-2 mb-6">
                {heading}
              </h2>
              <div className="space-y-1">
                {list.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    label={item.label}
                    checked={item.checked}
                    onToggle={() => updateItem.mutate({ itemId: item.id, checked: !item.checked })}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
