"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ConventionOutlineTree } from "@/components/conventions/ConventionOutlineTree";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { formatEventDate, formatEventDateRange } from "@kyarafit/design-system/domain";
import { PackingItemRow } from "@/components/conventions/PackingItemRow";
import { Calendar } from "@/components/ui/calendar";
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

  // conventions, conventionDayPlans, packingListItems and builds are all sync-backed
  // (`...syncMetaFields` in convex/schema.ts) — route them through the offline bridge.
  const convention = useOfflineQuery(api.conventions.get, id ? { id } : "skip");
  const plan = useOfflineQuery(api.conventions.getPlan, id ? { conventionId: id } : "skip") ?? [];
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const packingItems =
    useOfflineQuery(api.conventions.getPacking, id ? { conventionId: id } : "skip") ?? [];
  // groupConventionDays has no sync metadata (group features are online-only) — stay on convex/react.
  const groupsAtCon =
    useQuery(api.groupConventionDays.listGroupsForConvention, id ? { conventionId: id } : "skip") ??
    [];

  const replacePlanMut = useOfflineMutation(api.conventions.replacePlan);
  const updateConventionMut = useOfflineMutation(api.conventions.update);
  const regeneratePackingMut = useOfflineMutation(api.conventions.regeneratePacking);
  const updatePackingItemMut = useOfflineMutation(api.conventions.updatePackingItem);
  const addManualPackingItemMut = useOfflineMutation(api.conventions.addManualPackingItem);
  const deletePackingItemMut = useOfflineMutation(api.conventions.deletePackingItem);

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
        imageUrl: editImageUrl.trim() || null,
        imageStorageId: editImageStorageId,
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

  const plannedDayCount = useMemo(
    () => dates.filter((d) => planByDate.get(d)?.buildId).length,
    [dates, planByDate]
  );
  const packedCount = useMemo(() => packingItems.filter((i) => i.checked).length, [packingItems]);
  const packingTotal = packingItems.length;
  const packingPct = packingTotal > 0 ? Math.round((100 * packedCount) / packingTotal) : 0;

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

  const renderPackingGroup = (heading: string, list: typeof packingItems) => (
    <div key={heading}>
      <p className="font-explorer-mono mb-1 border-b border-glass-divider pb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
        {heading}
      </p>
      <ul>
        {list.map((item) => (
          <li key={item._id}>
            <PackingItemRow
              item={item}
              isManual={item.closetItemId === undefined}
              userId={userId}
              onToggle={() => {
                if (!userId) return;
                updatePackingItemMut({ id: item._id, userId, checked: !item.checked });
              }}
              onUpdate={(patch) =>
                userId && updatePackingItemMut({ id: item._id, userId, ...patch })
              }
              onDelete={
                item.closetItemId === undefined
                  ? () => userId && deletePackingItemMut({ id: item._id, userId })
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );

  if (convention === undefined) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Loading...
          </p>
        </div>
      </WebAppShell>
    );
  }
  if (!convention) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Convention not found.
          </p>
          <Link href="/conventions" className="mt-4 inline-block text-sm underline">
            Back to Conventions
          </Link>
        </div>
      </WebAppShell>
    );
  }

  const firstUnplanned = dates.find((d) => !planByDate.get(d)?.buildId) ?? dates[0];

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={convention.imageStorageId}
          imageUrl={convention.imageUrl}
          scrimRight="strong"
        />

        {/* Bar row (8a): back + breadcrumb eyebrow + edit icon */}
        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href="/conventions"
            aria-label="Back to events"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
            The season ▸ {convention.name}
          </span>
          {canEdit &&
            (editing ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={openEdit}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Edit event"
              >
                <span className="material-symbols-outlined font-light text-[22px]">edit</span>
              </button>
            ))}
        </div>

        <main className="relative z-10 mx-auto mb-16 mt-4 w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 flex-1">
          {editing && canEdit ? (
            <div className="mx-auto max-w-2xl space-y-6 bg-glass backdrop-blur-glass border border-glass-border rounded-glass p-6 sm:p-8">
              <div className="border-b border-glass-divider-strong pb-6">
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-media-fg-55 mb-2">
                  The season
                </span>
                <h1 className="font-serif italic text-3xl tracking-tight">Edit event</h1>
              </div>
              <form onSubmit={handleSaveConvention} className="space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Anime Expo"
                    className="w-full border-0 border-b border-glass-border bg-transparent py-3 text-base placeholder:text-media-fg-55 focus:outline-none focus:border-kyar-media-fg"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                    Location (optional)
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="City or venue"
                    className="w-full border-0 border-b border-glass-border bg-transparent py-3 text-base placeholder:text-media-fg-55 focus:outline-none focus:border-kyar-media-fg"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                    Dates
                  </label>
                  <div className="rounded-[10px] border border-glass-border bg-glass-active p-3">
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
                          "relative first-of-type:before:hidden before:absolute max-sm:before:inset-x-2 max-sm:before:h-px max-sm:before:-top-2 sm:before:inset-y-2 sm:before:w-px before:bg-glass-divider sm:before:-left-4",
                      }}
                    />
                    {(editStartDate || editEndDate) && (
                      <p className="mt-3 pt-3 border-t border-glass-divider text-xs text-media-fg-70 flex items-center gap-1.5">
                        <CalendarIcon className="size-3.5" />
                        {editStartDate}
                        {editEndDate && editStartDate !== editEndDate ? ` – ${editEndDate}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
                    Image (optional)
                  </label>
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
                <button
                  type="submit"
                  disabled={savePending || !editName.trim() || !editStartDate || !editEndDate}
                  className="w-full min-h-[52px] rounded-full bg-glass-solid text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  {savePending ? "Saving…" : "Save changes"}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 min-h-0">
              {/* Left: identity + day-plan rail (8a) */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="max-w-[720px]">
                  <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                    {formatEventDateRange(convention.startDate, convention.endDate)}
                    {convention.location ? ` · ${convention.location}` : ""}
                  </span>
                  <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] sm:text-[56px] lg:text-[72px]">
                    {convention.name}
                  </h1>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {daysUntilStart !== null && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                        Countdown ·{" "}
                        {daysUntilStart > 0
                          ? `${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`
                          : daysUntilStart === 0
                            ? "Today"
                            : `Started ${Math.abs(daysUntilStart)} day${Math.abs(daysUntilStart) === 1 ? "" : "s"} ago`}
                      </span>
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                      Builds · {plannedDayCount} of {dates.length} days planned
                    </span>
                    {packingTotal === 0 ? (
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-glass-chip-warn-fg">
                        Logistics pending
                      </span>
                    ) : (
                      <span
                        className={`text-[9px] font-bold uppercase tracking-[0.2em] ${
                          packedCount === packingTotal ? "text-on-glass-chip-done-fg" : "opacity-70"
                        }`}
                      >
                        Packing · {packedCount}/{packingTotal}
                      </span>
                    )}
                  </div>
                  {convention.location && (
                    <p className="mt-3 text-[13px] text-media-fg-70">
                      Accommodation: {convention.location} · Check-in{" "}
                      {formatEventDate(convention.startDate)}
                    </p>
                  )}
                  {groupsAtCon.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {groupsAtCon.map((g) => (
                        <li key={g._id}>
                          <Link
                            href={`/g/${g._id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2 text-[9px] font-bold uppercase tracking-[0.16em] backdrop-blur-glass-chip transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          >
                            <span className="material-symbols-outlined text-[14px]" aria-hidden>
                              group
                            </span>
                            {g.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && dates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerDate(firstUnplanned)}
                      className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-glass-solid px-[22px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      Plan a day
                    </button>
                  )}
                </div>

                {/* Day-plan rail (8a, lower-left) */}
                <div className="mt-auto pt-10">
                  <div className="mb-3 flex items-baseline gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                      Day plans · {dates.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOutline((v) => !v)}
                      className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      aria-expanded={showOutline}
                    >
                      Outline {showOutline ? "▾" : "▸"}
                    </button>
                  </div>
                  {showOutline && (
                    <div className="mb-4 max-w-[420px] rounded-glass border border-glass-border bg-glass backdrop-blur-glass p-2 max-h-[280px] overflow-y-auto">
                      <ConventionOutlineTree
                        conventionName={convention.name}
                        days={outlineDays}
                        onSelect={handleOutlineSelect}
                      />
                    </div>
                  )}
                  <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1">
                    {dates.map((date, idx) => {
                      const entry = planByDate.get(date);
                      const build = entry?.buildId
                        ? builds.find((b) => b._id === entry.buildId)
                        : null;
                      const buildPackingItems = entry?.buildId
                        ? packingItems.filter((item) => item.buildId === entry.buildId)
                        : [];
                      const totalItems = buildPackingItems.length;
                      const packedItems = buildPackingItems.filter((item) => item.checked).length;
                      const dayEyebrow = `Day ${idx + 1} · ${new Date(date).toLocaleDateString(
                        "en-US",
                        { weekday: "short", month: "short", day: "numeric" }
                      )}`;
                      return (
                        <button
                          key={date}
                          id={`day-${date}`}
                          type="button"
                          onClick={() => setPickerDate(date)}
                          className={`relative snap-start shrink-0 w-[170px] h-[190px] rounded-[10px] overflow-hidden text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent scroll-mt-24 ${
                            build
                              ? "bg-glass-active"
                              : "border border-dashed border-kyar-media-ring"
                          }`}
                          aria-label={
                            build ? `${dayEyebrow}: ${build.name}` : `${dayEyebrow}: assign a build`
                          }
                        >
                          {build ? (
                            <>
                              {build.imageStorageId || build.imageUrl ? (
                                <ResolvedImage
                                  imageStorageId={build.imageStorageId}
                                  imageUrl={build.imageUrl}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover"
                                  aria-hidden
                                />
                              ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-media-fg-45">
                                  <span className="material-symbols-outlined text-4xl" aria-hidden>
                                    image
                                  </span>
                                </span>
                              )}
                              <div className="absolute inset-0 bg-kyar-media-scrim" aria-hidden />
                              <div className="absolute left-0 right-0 bottom-0 p-2.5">
                                <span className="block text-[9px] font-bold uppercase tracking-[0.16em] opacity-70 mb-0.5">
                                  {dayEyebrow}
                                </span>
                                <span className="block font-serif italic text-[16px] leading-tight truncate">
                                  {build.name}
                                </span>
                                <span
                                  className={`mt-1 block text-[9px] font-bold uppercase tracking-[0.14em] ${
                                    totalItems === 0
                                      ? "text-on-glass-chip-warn-fg"
                                      : packedItems === totalItems
                                        ? "text-on-glass-chip-done-fg"
                                        : "opacity-70"
                                  }`}
                                >
                                  {totalItems === 0
                                    ? "Logistics pending"
                                    : `Packing ${packedItems}/${totalItems}`}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-media-fg-70">
                              <span className="material-symbols-outlined text-2xl" aria-hidden>
                                add
                              </span>
                              <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
                                {dayEyebrow}
                              </span>
                              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-70">
                                Assign a build
                              </span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: packing work panel (8a) */}
              <aside
                id="convention-logistics"
                className="w-full lg:w-[440px] shrink-0 self-start flex flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass min-h-0 lg:max-h-[calc(100dvh-180px)] scroll-mt-24"
                aria-label="Packing list"
              >
                <div className="px-5 py-4 border-b border-glass-divider-strong">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                      Packing list
                    </span>
                    <button
                      type="button"
                      onClick={handleRegeneratePacking}
                      className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      Sync builds
                    </button>
                  </div>
                  {packingTotal > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        className="h-[2px] flex-1 max-w-[220px] bg-glass-border rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={packedCount}
                        aria-valuemin={0}
                        aria-valuemax={packingTotal}
                      >
                        <div
                          className="h-full bg-kyar-media-fg rounded-full transition-[width] duration-300"
                          style={{ width: `${packingPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55 tabular-nums">
                        {packedCount} / {packingTotal} packed
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
                  {packingItems.length === 0 ? (
                    <p className="text-[13px] text-media-fg-55">
                      No items yet. Add below or sync from builds.
                    </p>
                  ) : (
                    (() => {
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
                          {general.length > 0 && renderPackingGroup("General", general)}
                          {dateKeys.map((key) =>
                            renderPackingGroup(byDate.get(key)![0]?.date ?? key, byDate.get(key)!)
                          )}
                        </>
                      );
                    })()
                  )}
                </div>

                <div className="border-t border-glass-divider-strong px-5 py-3.5 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPackingLabel}
                      onChange={(e) => setNewPackingLabel(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), handleAddPackingItem())
                      }
                      placeholder="Add packing item…"
                      className="flex-1 min-w-0 bg-transparent border-b border-glass-border py-2 text-[13px] focus:outline-none focus:border-kyar-media-fg placeholder:text-media-fg-55 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddPackingItem}
                      disabled={!newPackingLabel.trim() || !userId}
                      className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      Add
                    </button>
                  </div>
                  <Link
                    href={`/conventions/${id}/packing`}
                    className="inline-block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    <span className="border-b border-glass-border-strong pb-0.5">
                      Full packing view ▸
                    </span>
                  </Link>
                </div>
              </aside>
            </div>
          )}
        </main>

        {/* Assign-build picker — heavier-glass dialog (13d) */}
        {pickerDate !== null && (
          <div
            className="fixed inset-0 z-50 bg-scrim-dim backdrop-blur-[6px] flex items-center justify-center p-6"
            onClick={() => setPickerDate(null)}
          >
            <div
              className="w-full max-w-sm rounded-glass-overlay bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg p-6"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Assign build"
            >
              <h2 className="font-serif italic text-2xl mb-4 text-center">Assign build</h2>
              <p className="text-[10px] uppercase tracking-[0.16em] text-center text-media-fg-55 mb-6 border-b border-glass-divider pb-4">
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
                  className="block w-full text-left px-4 py-3 rounded-[10px] border border-glass-border hover:border-glass-border-strong hover:bg-glass-active transition-colors text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Rest day (clear)
                </button>
                {builds.map((b) => (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => handleAssign(pickerDate, b._id)}
                    className="block w-full text-left px-4 py-3 rounded-[10px] border border-glass-border hover:border-glass-border-strong hover:bg-glass-active transition-colors text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    {b.name}{" "}
                    <span className="text-media-fg-55 text-xs font-normal">
                      ({b.character || "Original"})
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPickerDate(null)}
                className="w-full min-h-[44px] py-3 text-[10px] font-bold uppercase tracking-[0.16em] rounded-full border border-glass-border-strong bg-glass-bar hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </WebAppShell>
  );
}
