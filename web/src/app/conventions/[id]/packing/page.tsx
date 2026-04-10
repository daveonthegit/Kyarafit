"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { PackingItemRow } from "@/components/conventions/PackingItemRow";

export default function ConventionPackingPage() {
  const params = useParams();
  const id = params.id as Id<"conventions">;
  const { userId } = useCurrentUser();
  const [newLabel, setNewLabel] = useState("");

  const convention = useQuery(api.conventions.get, id ? { id } : "skip");
  const items = useQuery(api.conventions.getPacking, id ? { conventionId: id } : "skip") ?? [];
  const updateItem = useMutation(api.conventions.updatePackingItem);
  const regenerate = useMutation(api.conventions.regeneratePacking);
  const addManual = useMutation(api.conventions.addManualPackingItem);
  const deleteItem = useMutation(api.conventions.deletePackingItem);

  const handleRegenerate = async () => {
    if (!userId) return;
    await regenerate({ userId, conventionId: id });
  };

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!userId || !label) return;
    await addManual({ userId, conventionId: id, label });
    setNewLabel("");
  };

  const general = items.filter((i) => !i.date && !i.buildId);
  const byDate = new Map<string, typeof items>();
  for (const i of items.filter((i) => i.date || i.buildId)) {
    const key = i.date ?? "general";
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(i);
  }
  const dateKeys = Array.from(byDate.keys()).sort();

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-kyar-bgWarm/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link
          href="/conventions"
          className="material-symbols-outlined font-light text-2xl"
          aria-label="Back to conventions"
        >
          arrow_back
        </Link>
        <div>
          <p className="meta-label">Packing</p>
          <h1 className="font-serif text-2xl font-bold italic">{convention?.name ?? "..."}</h1>
        </div>
      </header>

      <main className="flex-1 py-8">
        <p className="text-sm text-kyar-textTertiary mb-4">
          Generated from builds on the convention plan. Your own items are kept when you regenerate.
        </p>
        <button
          type="button"
          onClick={handleRegenerate}
          className="w-full bg-kyar-text text-kyar-bg py-3 text-[11px] font-bold uppercase tracking-wider mb-6 disabled:opacity-50"
        >
          Regenerate from builds
        </button>

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            placeholder="Add your own item…"
            className="flex-1 min-w-0 border border-kyar-borderSubtle bg-kyar-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newLabel.trim() || !userId}
            className="flex-shrink-0 bg-kyar-text text-kyar-bg px-4 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {items.length === 0 && (
          <p className="text-sm text-kyar-meta">
            No packing list yet. Generate from builds or add your own.
          </p>
        )}

        {general.length > 0 && (
          <section className="mb-10">
            <h2 className="font-serif text-xl font-bold italic border-b border-kyar-border pb-2 mb-6">
              General
            </h2>
            <div className="space-y-0">
              {general.map((item) => (
                <PackingItemRow
                  key={item._id}
                  item={{
                    _id: item._id,
                    label: item.label,
                    checked: item.checked,
                    date: item.date,
                    notes: item.notes,
                    closetItemId: item.closetItemId,
                  }}
                  isManual={item.closetItemId === undefined}
                  userId={userId}
                  onToggle={() => {
                    if (!userId) return;
                    updateItem({ id: item._id, userId, checked: !item.checked });
                  }}
                  onUpdate={(patch) => userId && updateItem({ id: item._id, userId, ...patch })}
                  onDelete={
                    item.closetItemId === undefined
                      ? () => userId && deleteItem({ id: item._id, userId })
                      : undefined
                  }
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
              <h2 className="font-serif text-xl font-bold italic border-b border-kyar-border pb-2 mb-6">
                {heading}
              </h2>
              <div className="space-y-0">
                {list.map((item) => (
                  <PackingItemRow
                    key={item._id}
                    item={{
                      _id: item._id,
                      label: item.label,
                      checked: item.checked,
                      date: item.date,
                      notes: item.notes,
                      closetItemId: item.closetItemId,
                    }}
                    isManual={item.closetItemId === undefined}
                    userId={userId}
                    onToggle={() => {
                      if (!userId) return;
                      updateItem({ id: item._id, userId, checked: !item.checked });
                    }}
                    onUpdate={(patch) => userId && updateItem({ id: item._id, userId, ...patch })}
                    onDelete={
                      item.closetItemId === undefined
                        ? () => userId && deleteItem({ id: item._id, userId })
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </WebAppShell>
  );
}
