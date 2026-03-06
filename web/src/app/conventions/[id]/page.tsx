"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { PackingItemRow } from "@/components/conventions/PackingItemRow";

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
  const { userId } = useCurrentUser();
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [newPackingLabel, setNewPackingLabel] = useState("");

  const convention = useQuery(api.conventions.get, id ? { id } : "skip");
  const plan = useQuery(api.conventions.getPlan, id ? { conventionId: id } : "skip") ?? [];
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const packingItems =
    useQuery(api.conventions.getPacking, id ? { conventionId: id } : "skip") ?? [];

  const replacePlanMut = useMutation(api.conventions.replacePlan);
  const regeneratePackingMut = useMutation(api.conventions.regeneratePacking);
  const updatePackingItemMut = useMutation(api.conventions.updatePackingItem);
  const addManualPackingItemMut = useMutation(api.conventions.addManualPackingItem);
  const deletePackingItemMut = useMutation(api.conventions.deletePackingItem);

  const dates = useMemo(
    () => (convention ? dateRange(convention.startDate, convention.endDate) : []),
    [convention]
  );
  const planByDate = useMemo(() => new Map(plan.map((e) => [e.date, e])), [plan]);

  const daysUntilStart = useMemo(() => {
    if (!convention) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(convention.startDate);
    startDate.setHours(0, 0, 0, 0);
    return Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [convention]);

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

  const handleRegeneratePacking = async () => {
    if (!userId) return;
    await regeneratePackingMut({ userId, conventionId: id });
  };

  const handleAddPackingItem = async () => {
    const label = newPackingLabel.trim();
    if (!userId || !label) return;
    await addManualPackingItemMut({ userId, conventionId: id, label });
    setNewPackingLabel("");
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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/conventions" className="material-symbols-outlined font-light text-2xl">
            arrow_back
          </Link>
          <p className="meta-label">Convention</p>
        </div>
        <Link
          href={`/conventions/${id}/edit`}
          className="text-sm font-medium underline hover:no-underline"
        >
          Edit
        </Link>
      </header>

      <main className="flex-1 py-8 pb-32 space-y-8">
        {(convention.imageStorageId || convention.imageUrl) && (
          <div className="rounded-lg overflow-hidden border border-kyar-borderSubtle aspect-[2/1] max-h-48 bg-kyar-muted/30">
            <ResolvedImage
              imageStorageId={convention.imageStorageId}
              imageUrl={convention.imageUrl}
              alt={convention.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div>
          <h1 className="font-serif text-3xl font-bold italic">{convention.name}</h1>
          <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary mt-2">
            {convention.startDate} – {convention.endDate}
            {convention.location ? ` · ${convention.location}` : ""}
          </p>
        </div>

        {daysUntilStart !== null && (
          <div className="border border-kyar-borderSubtle p-4">
            <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary mb-1">
              Countdown
            </p>
            <p className="font-serif text-2xl italic font-bold">
              {daysUntilStart > 0
                ? `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`
                : daysUntilStart === 0
                  ? "Starts today!"
                  : `Started ${Math.abs(daysUntilStart)} day${Math.abs(daysUntilStart) === 1 ? "" : "s"} ago`}
            </p>
          </div>
        )}

        <div>
          <h2 className="font-serif text-2xl italic font-bold mb-6">Cosplay Timeline</h2>
          <p className="text-[10px] uppercase tracking-wider text-kyar-textTertiary mb-4">
            Tap a day to assign a build
          </p>
          <div className="space-y-6">
            {dates.map((date, idx) => {
              const entry = planByDate.get(date);
              const build = entry?.buildId ? builds.find((b) => b._id === entry.buildId) : null;
              const dayLabel = `D${idx + 1}`;

              const buildPackingItems = entry?.buildId
                ? packingItems.filter((item) => item.buildId === entry.buildId)
                : [];
              const totalItems = buildPackingItems.length;
              let status = "Pending";
              let statusColor = "text-kyar-textTertiary";
              if (build) {
                if (totalItems > 0) {
                  const packedItems = buildPackingItems.filter((item) => item.checked).length;
                  status = `Ready to pack (${packedItems}/${totalItems} packed)`;
                  statusColor = "text-green-700";
                } else {
                  status = "Logistics pending";
                }
              }

              return (
                <div key={date} className="relative">
                  {idx < dates.length - 1 && (
                    <div className="absolute left-3 top-8 bottom-0 w-px bg-kyar-borderSubtle" />
                  )}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-kyar-borderSubtle bg-white flex items-center justify-center z-10">
                      <span className="text-[8px] font-bold">{idx + 1}</span>
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="flex justify-between items-baseline mb-2">
                        <div>
                          <h3 className="font-serif text-xl italic font-bold">{dayLabel}</h3>
                          <p className="text-[9px] text-kyar-textTertiary uppercase tracking-wider">
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPickerDate(date)}
                        className="w-full text-left rounded-none border border-kyar-borderSubtle hover:border-kyar-textTertiary transition-colors"
                      >
                        {build ? (
                          <div className="p-3 bg-white flex gap-3">
                            <div className="w-16 h-20 bg-kyar-muted flex items-center justify-center border border-kyar-borderSubtle overflow-hidden flex-shrink-0">
                              {build.imageStorageId || build.imageUrl ? (
                                <ResolvedImage
                                  imageStorageId={build.imageStorageId}
                                  imageUrl={build.imageUrl}
                                  alt={build.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="material-symbols-outlined text-2xl text-kyar-textTertiary">
                                  image
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold uppercase tracking-wide truncate">
                                {build.name}
                              </p>
                              <p className="text-[10px] text-kyar-textTertiary mt-0.5">{date}</p>
                              <p className={`text-[10px] mt-2 ${statusColor}`}>{status}</p>
                              <p className="text-[9px] text-kyar-textTertiary mt-2">
                                Tap to change
                              </p>
                            </div>
                            <span className="material-symbols-outlined text-kyar-textTertiary self-center">
                              chevron_right
                            </span>
                          </div>
                        ) : (
                          <div className="border border-dashed border-kyar-borderSubtle p-3 bg-kyar-muted/30">
                            <p className="text-xs text-kyar-textTertiary italic">Rest day</p>
                            <p className="text-[9px] text-kyar-textTertiary mt-1">
                              Tap to assign build
                            </p>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-kyar-borderSubtle pt-8">
          <h2 className="font-serif text-2xl italic font-bold mb-4">Logistics</h2>
          <div className="border border-kyar-borderSubtle p-4 mb-4">
            <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary mb-2">
              Accommodation
            </p>
            {convention.location ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{convention.location}</p>
                <p className="text-xs text-kyar-textTertiary">Check-in: {convention.startDate}</p>
              </div>
            ) : (
              <p className="text-xs text-kyar-textTertiary italic">
                No accommodation details added yet. Edit convention to add location.
              </p>
            )}
          </div>

          <div className="border border-kyar-borderSubtle p-4">
            <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary mb-2">
              Packing list
            </p>
            <p className="text-xs text-kyar-textTertiary mb-3">
              Generated from builds on the timeline. Add your own items below; they won’t be removed
              when you regenerate.
            </p>
            <button
              type="button"
              onClick={handleRegeneratePacking}
              className="w-full bg-black text-white py-2.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 mb-4"
            >
              Generate from builds
            </button>

            {packingItems.length === 0 ? (
              <p className="text-xs text-kyar-textTertiary italic mb-4">
                No items yet. Generate from builds or add your own.
              </p>
            ) : (
              <div className="space-y-4 mb-4">
                {(() => {
                  const general = packingItems.filter((i) => !i.date && !i.buildId);
                  const byDate = new Map<string, typeof packingItems>();
                  for (const i of packingItems.filter((i) => i.date || i.buildId)) {
                    const key = i.date ?? "general";
                    if (!byDate.has(key)) byDate.set(key, []);
                    byDate.get(key)!.push(i);
                  }
                  const dateKeys = Array.from(byDate.keys()).sort();
                  return (
                    <>
                      {general.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary mb-1">
                            General
                          </p>
                          <ul className="space-y-0">
                            {general.map((item) => (
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
                                    updatePackingItemMut({
                                      id: item._id,
                                      userId,
                                      checked: !item.checked,
                                    });
                                  }}
                                  onUpdate={(patch) =>
                                    userId &&
                                    updatePackingItemMut({ id: item._id, userId, ...patch })
                                  }
                                  onDelete={
                                    item.closetItemId === undefined
                                      ? () =>
                                          userId && deletePackingItemMut({ id: item._id, userId })
                                      : undefined
                                  }
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {dateKeys.map((key) => {
                        const list = byDate.get(key)!;
                        const heading = list[0]?.date ?? key;
                        return (
                          <div key={key}>
                            <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary mb-1">
                              {heading}
                            </p>
                            <ul className="space-y-0">
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
                                      updatePackingItemMut({
                                        id: item._id,
                                        userId,
                                        checked: !item.checked,
                                      });
                                    }}
                                    onUpdate={(patch) =>
                                      userId &&
                                      updatePackingItemMut({ id: item._id, userId, ...patch })
                                    }
                                    onDelete={
                                      item.closetItemId === undefined
                                        ? () =>
                                            userId && deletePackingItemMut({ id: item._id, userId })
                                        : undefined
                                    }
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newPackingLabel}
                onChange={(e) => setNewPackingLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPackingItem())}
                placeholder="Add your own item…"
                className="flex-1 min-w-0 border border-kyar-borderSubtle px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleAddPackingItem}
                disabled={!newPackingLabel.trim() || !userId}
                className="flex-shrink-0 bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          <Link
            href={`/conventions/${id}/packing`}
            className="block mt-4 text-sm underline text-kyar-textTertiary hover:text-black"
          >
            Open full packing list
          </Link>
        </div>
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
