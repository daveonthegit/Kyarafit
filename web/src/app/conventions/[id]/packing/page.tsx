"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { PackingItemRow } from "@/components/conventions/PackingItemRow";

export default function ConventionPackingPage() {
  const params = useParams();
  const id = params.id as Id<"conventions">;
  const { userId } = useCurrentUser();
  const [newLabel, setNewLabel] = useState("");

  // conventions + packingListItems are sync-backed (`...syncMetaFields` in convex/schema.ts) —
  // read/write through the offline bridge so the packing list works offline.
  const convention = useOfflineQuery(api.conventions.get, id ? { id } : "skip");
  const items =
    useOfflineQuery(api.conventions.getPacking, id ? { conventionId: id } : "skip") ?? [];
  const updateItem = useOfflineMutation(api.conventions.updatePackingItem);
  const regenerate = useOfflineMutation(api.conventions.regeneratePacking);
  const addManual = useOfflineMutation(api.conventions.addManualPackingItem);
  const deleteItem = useOfflineMutation(api.conventions.deletePackingItem);

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

  const packedCount = items.filter((i) => i.checked).length;
  const packingPct = items.length > 0 ? Math.round((100 * packedCount) / items.length) : 0;

  const renderGroup = (heading: string, list: typeof items) => (
    <section key={heading}>
      <p className="font-explorer-mono mb-1 border-b border-glass-divider pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
        {heading}
      </p>
      <ul>
        {list.map((item) => (
          <li key={item._id}>
            <PackingItemRow
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
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={convention?.imageStorageId}
          imageUrl={convention?.imageUrl}
        />

        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href={`/conventions/${id}`}
            aria-label="Back to event"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
            The season ▸ {convention?.name ?? "…"} · Packing
          </span>
        </div>

        <main className="relative z-10 mx-auto mb-16 mt-4 w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 flex-1">
          <div className="max-w-[720px]">
            <h1 className="font-serif italic font-normal text-[38px] lg:text-[56px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] mb-3">
              Packing
            </h1>
            <p className="text-[13px] text-media-fg-70 max-w-[440px]">
              Generated from builds on the event plan. Your own items are kept when you regenerate.
            </p>
          </div>

          <section className="mt-8 max-w-[720px] flex flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass">
            <div className="px-5 py-4 border-b border-glass-divider-strong">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                  Packing list · {items.length}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Regenerate from builds
                </button>
              </div>
              {items.length > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-[2px] flex-1 max-w-[260px] bg-glass-border rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={packedCount}
                    aria-valuemin={0}
                    aria-valuemax={items.length}
                  >
                    <div
                      className="h-full bg-kyar-media-fg rounded-full transition-[width] duration-300"
                      style={{ width: `${packingPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55 tabular-nums">
                    {packedCount} / {items.length} packed
                  </span>
                </div>
              )}
            </div>

            <div className="px-5 py-4 space-y-6">
              {items.length === 0 && (
                <p className="text-[13px] text-media-fg-55">
                  No packing list yet. Generate from builds or add your own.
                </p>
              )}
              {general.length > 0 && renderGroup("General", general)}
              {dateKeys.map((key) =>
                renderGroup(byDate.get(key)![0]?.date ?? key, byDate.get(key)!)
              )}
            </div>

            <div className="border-t border-glass-divider-strong px-5 py-3.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
                  placeholder="Add packing item…"
                  className="flex-1 min-w-0 bg-transparent border-b border-glass-border py-2 text-[13px] focus:outline-none focus:border-kyar-media-fg placeholder:text-media-fg-55 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newLabel.trim() || !userId}
                  className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Add
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </WebAppShell>
  );
}
