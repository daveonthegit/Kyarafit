"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ConventionOutlineTree } from "@/components/conventions/ConventionOutlineTree";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { PackingItemRow } from "@/components/conventions/PackingItemRow";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as Id<"conventions">;
  const { userId } = useCurrentUser();
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [newPackingLabel, setNewPackingLabel] = useState("");
  const [showOutline, setShowOutline] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>(undefined);
  const [editImageStorageId, setEditImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [savePending, setSavePending] = useState(false);
  const processedEditQuery = useRef(false);

  const convention = useQuery(api.conventions.get, id ? { id } : "skip");
  const plan = useQuery(api.conventions.getPlan, id ? { conventionId: id } : "skip") ?? [];
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const packingItems =
    useQuery(api.conventions.getPacking, id ? { conventionId: id } : "skip") ?? [];
  const groupsAtCon =
    useQuery(api.groupConventionDays.listGroupsForConvention, id ? { conventionId: id } : "skip") ??
    [];

  const replacePlanMut = useMutation(api.conventions.replacePlan);
  const updateConventionMut = useMutation(api.conventions.update);
  const regeneratePackingMut = useMutation(api.conventions.regeneratePacking);
  const updatePackingItemMut = useMutation(api.conventions.updatePackingItem);
  const addManualPackingItemMut = useMutation(api.conventions.addManualPackingItem);
  const deletePackingItemMut = useMutation(api.conventions.deletePackingItem);

  const dates = useMemo(
    () => (convention ? dateRange(convention.startDate, convention.endDate) : []),
    [convention]
  );
  const planByDate = useMemo(() => new Map(plan.map((e) => [e.date, e])), [plan]);

  const canEdit = useMemo(
    () => Boolean(userId && convention && convention.userId === userId),
    [userId, convention]
  );

  const hydrateEditForm = useCallback(() => {
    if (!convention) return;
    setEditName(convention.name);
    setEditLocation(convention.location ?? "");
    setEditDateRange({
      from: new Date(convention.startDate),
      to: new Date(convention.endDate),
    });
    setEditImageStorageId(convention.imageStorageId ?? null);
    setEditImageUrl(convention.imageUrl ?? "");
  }, [convention]);

  const openEdit = useCallback(() => {
    hydrateEditForm();
    setEditing(true);
  }, [hydrateEditForm]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  useEffect(() => {
    if (processedEditQuery.current) return;
    if (searchParams.get("edit") !== "1") return;
    if (convention === undefined) return;
    processedEditQuery.current = true;
    router.replace(`/conventions/${id}`, { scroll: false });
    if (convention && userId && convention.userId === userId) {
      hydrateEditForm();
      setEditing(true);
    }
  }, [searchParams, convention, userId, router, id, hydrateEditForm]);

  const editStartDate = editDateRange?.from ? format(editDateRange.from, "yyyy-MM-dd") : "";
  const editEndDate = editDateRange?.to
    ? format(editDateRange.to, "yyyy-MM-dd")
    : editDateRange?.from
      ? format(editDateRange.from, "yyyy-MM-dd")
      : "";

  const handleSaveConvention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editStartDate || !editEndDate || !userId || !convention) return;
    if (convention.userId !== userId) return;
    setSavePending(true);
    try {
      await updateConventionMut({
        id,
        userId,
        name: editName.trim(),
        location: editLocation.trim() || undefined,
        startDate: editStartDate,
        endDate: editEndDate,
        imageUrl: editImageUrl.trim() || undefined,
        imageStorageId: editImageStorageId ?? undefined,
      });
      setEditing(false);
    } finally {
      setSavePending(false);
    }
  };

  const outlineDays = useMemo(
    () =>
      dates.map((date) => {
        const entry = planByDate.get(date);
        const build = entry?.buildId ? builds.find((b) => b._id === entry.buildId) : null;
        return { date, buildName: build?.name ?? null };
      }),
    [dates, planByDate, builds]
  );

  const handleOutlineSelect = useCallback((nodeId: string) => {
    if (nodeId === "logistics") {
      document.getElementById("convention-logistics")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (nodeId.startsWith("day-")) {
      const date = nodeId.replace(/^day-/, "");
      document.getElementById(`day-${date}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

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
      <header className="sticky top-0 z-40 bg-kyar-bg/95 backdrop-blur-sm pt-4 sm:pt-6 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/conventions"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 shrink-0"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kyar-meta font-mono truncate">
            {editing ? "Edit convention" : "Convention"}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-kyar-borderSubtle rounded-full hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={openEdit}
                className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-black text-white rounded-full hover:bg-black/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 py-8">
        {editing && canEdit ? (
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <form onSubmit={handleSaveConvention} className="space-y-6">
              <div>
                <label className="block meta-label mb-2">NAME</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Anime Expo"
                  className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
                />
              </div>
              <div>
                <label className="block meta-label mb-2">LOCATION (OPTIONAL)</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="City or venue"
                  className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
                />
              </div>
              <div>
                <label className="block meta-label mb-2">DATES</label>
                <div className="rounded-lg border border-kyar-borderSubtle bg-kyar-muted/30 p-3">
                  <Calendar
                    mode="range"
                    selected={editDateRange}
                    onSelect={setEditDateRange}
                    numberOfMonths={2}
                    pagedNavigation
                    showOutsideDays={false}
                    className="mx-auto"
                    classNames={{
                      months: "gap-6 sm:gap-8",
                      month:
                        "relative first-of-type:before:hidden before:absolute max-sm:before:inset-x-2 max-sm:before:h-px max-sm:before:-top-2 sm:before:inset-y-2 sm:before:w-px before:bg-kyar-borderSubtle sm:before:-left-4",
                    }}
                  />
                  {(editStartDate || editEndDate) && (
                    <p className="mt-3 pt-3 border-t border-kyar-borderSubtle text-xs text-kyar-meta flex items-center gap-1.5">
                      <CalendarIcon className="size-3.5" />
                      {editStartDate}
                      {editEndDate && editStartDate !== editEndDate ? ` – ${editEndDate}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block meta-label mb-2">IMAGE (OPTIONAL)</label>
                <ImageUpload
                  category="conventions"
                  onImageSelected={(result) => {
                    if ("imageStorageId" in result && result.imageStorageId) {
                      setEditImageStorageId(result.imageStorageId);
                      setEditImageUrl("");
                    } else {
                      setEditImageUrl(result.imageUrl ?? "");
                      setEditImageStorageId(null);
                    }
                  }}
                  currentImage={editImageUrl || undefined}
                  currentStorageId={editImageStorageId ?? undefined}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={savePending || !editName.trim() || !editStartDate || !editEndDate}
                className="w-full"
              >
                SAVE CHANGES
              </Button>
            </form>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] xl:grid-cols-[minmax(0,500px)_1fr] gap-8 lg:gap-16 max-w-6xl mx-auto">
          {/* Left Column (Sticky Image) */}
          <div className="lg:sticky lg:top-24 h-[60vh] lg:h-[calc(100vh-8rem)]">
            <div className="w-full h-full bg-kyar-muted overflow-hidden rounded-2xl shadow-soft relative">
              {convention.imageStorageId || convention.imageUrl ? (
                <ResolvedImage
                  imageStorageId={convention.imageStorageId}
                  imageUrl={convention.imageUrl}
                  alt={convention.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                  <span className="material-symbols-outlined text-6xl">event</span>
                </div>
              )}
              <div className="absolute bottom-6 left-6 bg-black text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-sm">
                EVENT {convention.startDate.substring(0, 4)}
              </div>
            </div>
          </div>

          {/* Right Column (Details) */}
          <div className="flex flex-col pt-4 lg:pt-8 min-w-0 pb-32">
            <div className="flex justify-between items-start gap-4 mb-8">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-meta leading-relaxed max-w-[60%]">
                {daysUntilStart !== null && daysUntilStart > 0
                  ? `STARTS IN ${daysUntilStart} DAY${daysUntilStart === 1 ? "" : "S"}`
                  : daysUntilStart === 0
                    ? "STARTS TODAY"
                    : `STARTED ${Math.abs(daysUntilStart!)} DAY${Math.abs(daysUntilStart!) === 1 ? "" : "S"} AGO`}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text shrink-0 text-right leading-relaxed">
                {new Date(convention.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                -{" "}
                {new Date(convention.endDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {convention.location && (
                  <>
                    <br />
                    {convention.location}
                  </>
                )}
              </p>
            </div>

            <h1 className="font-serif text-5xl lg:text-6xl font-normal italic tracking-tight mb-16 leading-none">
              {convention.name}
            </h1>

            {groupsAtCon.length > 0 && (
              <section className="mb-12">
                <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                  Group Cosplays
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {groupsAtCon.map((g) => (
                    <li key={g._id}>
                      <Link
                        href={`/g/${g._id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-kyar-borderSubtle rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
                      >
                        {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mb-16 border border-kyar-borderSubtle rounded-2xl overflow-hidden shadow-soft bg-kyar-surface">
              <button
                type="button"
                onClick={() => setShowOutline((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-kyar-textTertiary hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset"
                aria-expanded={showOutline}
              >
                <span>Outline / Quick Jump</span>
                <span
                  className={`material-symbols-outlined text-lg transition-transform ${showOutline ? "rotate-180" : ""}`}
                >
                  expand_more
                </span>
              </button>
              {showOutline && (
                <div className="border-t border-kyar-borderSubtle p-2 max-h-[280px] overflow-y-auto">
                  <ConventionOutlineTree
                    conventionName={convention.name}
                    days={outlineDays}
                    onSelect={handleOutlineSelect}
                  />
                </div>
              )}
            </div>

            <div className="mb-16">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                Cosplay Timeline
              </h2>

              <div className="relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-kyar-borderSubtle space-y-12">
                {dates.map((date, idx) => {
                  const entry = planByDate.get(date);
                  const build = entry?.buildId ? builds.find((b) => b._id === entry.buildId) : null;
                  const dayLabel = `DAY ${idx + 1}`;

                  const buildPackingItems = entry?.buildId
                    ? packingItems.filter((item) => item.buildId === entry.buildId)
                    : [];
                  const totalItems = buildPackingItems.length;
                  let status = "PENDING";
                  let statusColor = "text-kyar-textTertiary";
                  if (build) {
                    if (totalItems > 0) {
                      const packedItems = buildPackingItems.filter((item) => item.checked).length;
                      status = `PACKING (${packedItems}/${totalItems})`;
                      statusColor =
                        packedItems === totalItems ? "text-green-600" : "text-kyar-text";
                    } else {
                      status = "LOGISTICS PENDING";
                    }
                  }

                  const isEven = idx % 2 === 0;

                  return (
                    <div
                      key={date}
                      id={`day-${date}`}
                      className={`relative flex items-center justify-between md:justify-normal ${isEven ? "md:flex-row-reverse" : ""} group scroll-mt-24`}
                    >
                      <div
                        className={`hidden md:block w-[calc(50%-2rem)] ${isEven ? "text-left" : "text-right"}`}
                      >
                        <h3 className="font-serif text-2xl italic font-bold">{dayLabel}</h3>
                        <p className="text-[9px] text-kyar-textTertiary uppercase tracking-wider mt-1">
                          {new Date(date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="absolute left-0 md:left-1/2 flex items-center justify-center w-6 h-6 rounded-full border-[3px] border-kyar-bg bg-black text-white md:-translate-x-1/2 shadow-sm z-10">
                        <span className="text-[8px] font-bold">{idx + 1}</span>
                      </div>

                      <div className="ml-10 md:ml-0 w-[calc(100%-3rem)] md:w-[calc(50%-2rem)]">
                        <div className="md:hidden mb-3">
                          <h3 className="font-serif text-xl italic font-bold">{dayLabel}</h3>
                          <p className="text-[9px] text-kyar-textTertiary uppercase tracking-wider">
                            {new Date(date).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPickerDate(date)}
                          className="w-full text-left rounded-2xl border border-kyar-borderSubtle hover:border-black hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent overflow-hidden bg-kyar-surface group/card"
                        >
                          {build ? (
                            <div className="flex flex-col">
                              <div className="aspect-[3/2] w-full bg-kyar-muted relative border-b border-kyar-borderSubtle">
                                {build.imageStorageId || build.imageUrl ? (
                                  <ResolvedImage
                                    imageStorageId={build.imageStorageId}
                                    imageUrl={build.imageUrl}
                                    alt={build.name}
                                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                                    <span className="material-symbols-outlined text-3xl">
                                      image
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="p-5 flex-1 flex flex-col justify-between">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest truncate text-kyar-meta mb-1">
                                    {build.character || "ORIGINAL"}
                                  </p>
                                  <p className="font-serif italic text-xl font-bold truncate">
                                    {build.name}
                                  </p>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                  <p
                                    className={`text-[8px] font-bold uppercase tracking-[0.2em] ${statusColor}`}
                                  >
                                    {status}
                                  </p>
                                  <span className="material-symbols-outlined text-[14px] text-kyar-textTertiary">
                                    chevron_right
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="border border-dashed border-kyar-borderSubtle p-6 bg-kyar-muted/30 flex flex-col items-center justify-center aspect-[3/2] text-center hover:bg-kyar-muted/50 transition-colors">
                              <span className="material-symbols-outlined text-2xl text-kyar-textTertiary mb-2">
                                add_circle
                              </span>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-kyar-textTertiary">
                                Rest Day
                              </p>
                              <p className="text-[9px] text-kyar-textTertiary mt-1 uppercase tracking-widest">
                                Tap to assign
                              </p>
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div id="convention-logistics" className="mb-16 scroll-mt-24">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                Logistics & Packing
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="border border-kyar-borderSubtle rounded-2xl bg-kyar-surface shadow-soft p-6 self-start">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-kyar-meta mb-4">
                    Accommodation
                  </p>
                  {convention.location ? (
                    <div className="space-y-1">
                      <p className="font-serif text-xl italic">{convention.location}</p>
                      <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary mt-2">
                        Check-in: {convention.startDate}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-kyar-textTertiary italic">
                      No accommodation details.
                    </p>
                  )}
                </div>

                <div className="border border-kyar-borderSubtle rounded-2xl bg-kyar-surface shadow-soft p-6">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-kyar-meta">
                      Packing List
                    </p>
                    <button
                      type="button"
                      onClick={handleRegeneratePacking}
                      className="text-[9px] font-bold uppercase tracking-widest text-kyar-accent hover:text-black transition-colors"
                    >
                      SYNC BUILDS
                    </button>
                  </div>

                  {packingItems.length === 0 ? (
                    <p className="text-xs text-kyar-textTertiary italic mb-4">
                      No items yet. Add below or sync from builds.
                    </p>
                  ) : (
                    <div className="space-y-6 mb-6 max-h-[300px] overflow-y-auto pr-2">
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
                                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-kyar-meta mb-2 border-b border-kyar-borderSubtle pb-1">
                                  GENERAL
                                </p>
                                <ul className="space-y-1">
                                  {general.map((item) => (
                                    <li key={item._id}>
                                      <PackingItemRow
                                        item={item}
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
                                                userId &&
                                                deletePackingItemMut({ id: item._id, userId })
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
                                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-kyar-meta mb-2 border-b border-kyar-borderSubtle pb-1">
                                    {heading}
                                  </p>
                                  <ul className="space-y-1">
                                    {list.map((item) => (
                                      <li key={item._id}>
                                        <PackingItemRow
                                          item={item}
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
                                                  userId &&
                                                  deletePackingItemMut({ id: item._id, userId })
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

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPackingLabel}
                        onChange={(e) => setNewPackingLabel(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && (e.preventDefault(), handleAddPackingItem())
                        }
                        placeholder="Add manual item..."
                        className="flex-1 min-w-0 bg-transparent border-b border-kyar-borderSubtle py-2 text-xs focus:outline-none focus:border-black placeholder:text-kyar-meta transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleAddPackingItem}
                        disabled={!newPackingLabel.trim() || !userId}
                        className="text-[9px] font-bold uppercase tracking-widest text-kyar-text hover:text-kyar-accent transition-colors disabled:opacity-50 shrink-0"
                      >
                        ADD
                      </button>
                    </div>
                    <Link
                      href={`/conventions/${id}/packing`}
                      className="text-[9px] font-bold uppercase tracking-widest text-center py-3 border border-kyar-borderSubtle rounded-full hover:bg-black hover:text-white transition-colors block mt-2"
                    >
                      FULL PACKING VIEW
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
        )}
      </main>

      {pickerDate !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPickerDate(null)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-2xl italic font-bold mb-6 text-center">Assign Build</h2>
            <p className="text-[10px] uppercase tracking-widest text-center text-kyar-meta mb-6 border-b border-kyar-borderSubtle pb-4">
              {new Date(pickerDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>

            <div className="max-h-[50vh] overflow-y-auto space-y-2 mb-6">
              <button
                type="button"
                onClick={() => handleAssign(pickerDate, null)}
                className="block w-full text-left px-4 py-3 rounded-xl border border-kyar-borderSubtle hover:border-black hover:bg-kyar-muted transition-colors text-sm font-medium"
              >
                Rest Day (Clear)
              </button>
              {builds.map((b) => (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => handleAssign(pickerDate, b._id)}
                  className="block w-full text-left px-4 py-3 rounded-xl border border-kyar-borderSubtle hover:border-black hover:bg-kyar-muted transition-colors text-sm font-medium"
                >
                  {b.name}{" "}
                  <span className="text-kyar-meta text-xs font-normal">
                    ({b.character || "Original"})
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPickerDate(null)}
              className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-kyar-text hover:bg-kyar-muted rounded-full transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
    </WebAppShell>
  );
}
