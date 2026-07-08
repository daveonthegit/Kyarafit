"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

function getDatesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start);
  const endDate = new Date(end);
  while (d <= endDate) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = typeof params.groupId === "string" ? (params.groupId as Id<"groups">) : null;
  const { userId } = useCurrentUser();

  const data = useQuery(
    api.groups.getWithMembers,
    groupId && userId ? { groupId, userId } : groupId ? { groupId } : "skip"
  );
  const builds = useQuery(api.builds.listByGroup, groupId ? { groupId } : "skip") ?? [];
  const conventionDays =
    useQuery(api.groupConventionDays.listForGroupWithConventions, groupId ? { groupId } : "skip") ??
    [];
  const myConventions = useQuery(api.conventions.list, userId ? { userId } : "skip") ?? [];
  const myBuilds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const setDays = useMutation(api.groupConventionDays.setDays);
  const setBuildGroup = useMutation(api.builds.setGroupId);

  const [conventionPickerOpen, setConventionPickerOpen] = useState(false);
  const [linkConventionOpen, setLinkConventionOpen] = useState(false);
  const [selectedConventionId, setSelectedConventionId] = useState<Id<"conventions"> | null>(null);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [daysPending, setDaysPending] = useState(false);

  const [buildPickerOpen, setBuildPickerOpen] = useState(false);

  const group = data?.group;
  const members = data?.members ?? [];
  const myRole = data?.myRole;
  const isAdmin = myRole === "admin";

  const selectedConvention = useMemo(
    () => myConventions.find((c) => c._id === selectedConventionId),
    [myConventions, selectedConventionId]
  );
  const datesInRange = useMemo(
    () =>
      selectedConvention
        ? getDatesInRange(selectedConvention.startDate, selectedConvention.endDate)
        : [],
    [selectedConvention]
  );
  const linkableConventions = useMemo(
    () => myConventions.filter((c) => !conventionDays.some((cd) => cd.conventionId === c._id)),
    [myConventions, conventionDays]
  );

  const handleOpenConventionPicker = (conventionId: Id<"conventions">) => {
    setSelectedConventionId(conventionId);
    const existing = conventionDays.find((c) => c.conventionId === conventionId);
    setSelectedDates(existing ? new Set(existing.dates) : new Set());
    setLinkConventionOpen(false);
    setConventionPickerOpen(true);
  };

  const handleSaveDays = async () => {
    if (!groupId || !userId || !selectedConventionId || !isAdmin) return;
    setDaysPending(true);
    try {
      await setDays({
        groupId,
        conventionId: selectedConventionId,
        userId,
        dates: Array.from(selectedDates),
      });
      setConventionPickerOpen(false);
    } finally {
      setDaysPending(false);
    }
  };

  const toggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleAddBuildToGroup = async (buildId: Id<"builds">) => {
    if (!groupId || !userId) return;
    await setBuildGroup({ buildId, userId, groupId });
    setBuildPickerOpen(false);
  };

  const handleRemoveBuildFromGroup = async (buildId: Id<"builds">) => {
    if (!groupId || !userId) return;
    await setBuildGroup({ buildId, userId, groupId: null });
  };

  if (!groupId) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Missing group id.
          </p>
          <Link href="/groups" className="mt-4 inline-block text-sm underline">
            Back to Groups
          </Link>
        </div>
      </WebAppShell>
    );
  }

  if (data === undefined) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <OnlineOnlyBanner surface="glass" className="mt-6" />
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Loading…
          </p>
        </div>
      </WebAppShell>
    );
  }

  if (!group) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex-1 bg-studio-wall text-kyar-media-fg px-6 lg:px-10">
          <p className="pt-12 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70">
            Group not found or not visible.
          </p>
          <Link href="/groups" className="mt-4 inline-block text-sm underline">
            Back to Groups
          </Link>
        </div>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={group.imageStorageId}
          imageUrl={group.imageUrl}
          scrimRight="strong"
        />

        {/* Bar row: back + breadcrumb + share */}
        <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 flex items-center gap-4">
          <Link
            href="/groups"
            aria-label="Back to groups"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <span className="flex-1 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
            Your groups ▸ {group.name}
          </span>
          {userId && (
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: group.name, url: window.location.href });
                }
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              aria-label="Share"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
            </button>
          )}
        </div>

        <main className="relative z-10 mx-auto mb-16 mt-4 w-full max-w-[1600px] px-4 sm:px-6 lg:px-10 flex-1">
          <OnlineOnlyBanner surface="glass" className="mb-4 max-w-[720px]" />
          <div className="flex flex-col lg:flex-row gap-6 min-h-0">
            {/* Left: identity + member row + convention day rail (12d) */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="max-w-[720px]">
                <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
                  {group.visibility} group
                </span>
                <h1 className="font-serif italic font-normal text-[40px] leading-[0.95] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)] sm:text-[56px] lg:text-[72px]">
                  {group.name}
                </h1>

                {/* Overlapping member-avatar row (12d) */}
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {members.length > 0 && (
                    <div className="flex items-center">
                      {members.slice(0, 8).map((m, i) => (
                        <span
                          key={m.userId}
                          title={`${m.name} · ${m.role}`}
                          className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[rgb(12_11_20/0.6)] bg-glass ${
                            i > 0 ? "-ml-3" : ""
                          }`}
                          style={{ zIndex: members.length - i }}
                        >
                          {m.imageStorageId ? (
                            <ResolvedImage
                              imageStorageId={m.imageStorageId}
                              alt={m.name}
                              className="h-full w-full object-cover"
                            />
                          ) : m.image ? (
                            <img
                              src={m.image}
                              alt={m.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-media-fg-55">
                              <span className="material-symbols-outlined text-lg" aria-hidden>
                                person
                              </span>
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70">
                    {members.length} member{members.length !== 1 && "s"} · {builds.length} build
                    {builds.length !== 1 && "s"}
                  </span>
                </div>

                {group.description && (
                  <p className="mt-4 max-w-[480px] whitespace-pre-wrap text-[13px] leading-relaxed text-media-fg-70">
                    {group.description}
                  </p>
                )}
              </div>

              {/* Convention day rail (12d, bottom-left) */}
              <div className="mt-auto pt-10">
                <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                  Conventions · {conventionDays.length}
                </span>
                <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1">
                  {conventionDays.map((c) => (
                    <div
                      key={c.conventionId}
                      className="snap-start shrink-0 w-[220px] rounded-[10px] bg-glass backdrop-blur-glass border border-glass-border p-3.5"
                    >
                      <p className="font-serif italic text-[17px] leading-tight truncate mb-2">
                        {c.conventionName}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {c.dates.map((date) => (
                          <span
                            key={date}
                            className="rounded-full bg-on-glass-chip-neutral-bg px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-on-glass-chip-neutral-fg"
                          >
                            {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ))}
                        {c.dates.length === 0 && (
                          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-on-glass-chip-warn-fg">
                            No days picked
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenConventionPicker(c.conventionId as Id<"conventions">)
                          }
                          className="mt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                        >
                          Edit days
                        </button>
                      )}
                    </div>
                  ))}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setLinkConventionOpen(true)}
                      className="flex snap-start shrink-0 w-[220px] min-h-[110px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-kyar-media-ring text-media-fg-70 hover:text-kyar-media-fg hover:border-glass-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      aria-label="Link a convention"
                    >
                      <span className="material-symbols-outlined text-2xl" aria-hidden>
                        add
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
                        Link a convention
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: builds work panel (12d) */}
            <aside
              className="w-full lg:w-[440px] shrink-0 self-start flex flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass min-h-0 lg:max-h-[calc(100dvh-180px)]"
              aria-label="Builds in this group"
            >
              <div className="px-5 py-4 border-b border-glass-divider-strong">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                  Builds in this group · {builds.length}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {builds.length === 0 ? (
                  <p className="px-5 py-4 text-[13px] text-media-fg-55">No builds added yet.</p>
                ) : (
                  builds.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-center gap-4 px-5 py-3 border-b border-glass-divider"
                    >
                      <Link
                        href={`/build-detail/${b._id}`}
                        className="flex min-w-0 flex-1 items-center gap-4 rounded-[10px] transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                        aria-label={`View ${b.name}`}
                      >
                        <div className="h-[66px] w-[52px] shrink-0 overflow-hidden rounded-lg border border-glass-border bg-glass-active">
                          {b.imageStorageId ? (
                            <ResolvedImage
                              imageStorageId={b.imageStorageId}
                              alt=""
                              className="h-full w-full object-cover"
                              aria-hidden
                            />
                          ) : b.imageUrl ? (
                            <img
                              src={b.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              aria-hidden
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-media-fg-45">
                              <span className="material-symbols-outlined text-lg" aria-hidden>
                                palette
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {b.character && (
                            <span className="block truncate text-[9px] font-bold uppercase tracking-[0.16em] opacity-55">
                              {b.character}
                            </span>
                          )}
                          <span className="block truncate font-serif italic text-[17px] leading-tight">
                            {b.name}
                          </span>
                        </div>
                        <span
                          className="material-symbols-outlined shrink-0 text-[16px] opacity-50"
                          aria-hidden
                        >
                          chevron_right
                        </span>
                      </Link>
                      {userId === b.userId && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBuildFromGroup(b._id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-media-fg-55 transition-colors hover:bg-glass-active hover:text-on-glass-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          aria-label={`Remove ${b.name} from group`}
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {userId && (
                <div className="border-t border-glass-divider-strong px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => setBuildPickerOpen(true)}
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    <span className="border-b border-glass-border-strong pb-0.5">
                      Add my build ▸
                    </span>
                  </button>
                </div>
              )}
            </aside>
          </div>
        </main>

        {/* Link-a-convention picker — heavier glass (13d) */}
        {linkConventionOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim-dim backdrop-blur-[6px]"
            onClick={() => setLinkConventionOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-glass-overlay bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg p-6 sm:p-8"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Link a convention"
            >
              <h3 className="font-serif italic text-2xl mb-6 text-center">Link a convention</h3>
              <div className="max-h-[50vh] overflow-y-auto space-y-2 mb-6">
                {linkableConventions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-media-fg-55">
                    No new conventions available.
                  </p>
                ) : (
                  linkableConventions.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleOpenConventionPicker(c._id)}
                      className="block w-full rounded-[10px] border border-glass-border px-4 py-3 text-left text-sm font-medium transition-colors hover:border-glass-border-strong hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setLinkConventionOpen(false)}
                className="w-full min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Day picker — heavier glass (13d) */}
        {conventionPickerOpen && selectedConvention && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim-dim backdrop-blur-[6px]">
            <div
              className="w-full max-w-md rounded-glass-overlay bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg p-6 sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-label={`Pick days for ${selectedConvention.name}`}
            >
              <h3 className="font-serif italic text-3xl mb-2 text-center">
                {selectedConvention.name}
              </h3>
              <p className="mb-8 text-center text-sm text-media-fg-70">
                Select days the group is wearing this cosplay:
              </p>
              <div className="mb-8 flex max-h-[40vh] flex-col gap-3 overflow-y-auto">
                {datesInRange.map((date) => (
                  <label
                    key={date}
                    className="group flex cursor-pointer items-center gap-4 rounded-[10px] border border-glass-border p-3 transition-colors hover:border-glass-border-strong hover:bg-glass-active"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDates.has(date)}
                      onChange={() => toggleDate(date)}
                      className="h-5 w-5 cursor-pointer rounded-full border-2 border-media-fg-45 bg-transparent accent-kyar-media-fg transition-colors checked:border-glass-solid checked:bg-glass-solid focus:ring-2 focus:ring-kyar-accent focus:ring-offset-0"
                    />
                    <div>
                      <span className="block text-sm font-medium">
                        {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                          weekday: "long",
                        })}
                      </span>
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
                        {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConventionPickerOpen(false)}
                  className="flex-1 min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDays}
                  disabled={daysPending}
                  className="flex-1 min-h-[44px] rounded-full bg-glass-solid py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  {daysPending ? "Saving…" : "Save days"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Build picker — heavier glass (13d) */}
        {buildPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim-dim backdrop-blur-[6px]"
            onClick={() => setBuildPickerOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-glass-overlay bg-glass-overlay-on-wall backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay text-kyar-media-fg p-6 sm:p-8"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Select build"
            >
              <h3 className="font-serif italic text-3xl mb-6 text-center">Select build</h3>

              <div className="mb-8 max-h-[50vh] space-y-2 overflow-y-auto">
                {myBuilds.filter((b) => !builds.some((gb) => gb._id === b._id)).length === 0 ? (
                  <p className="py-4 text-center text-sm text-media-fg-55">
                    No available builds to add.
                  </p>
                ) : (
                  myBuilds
                    .filter((b) => !builds.some((gb) => gb._id === b._id))
                    .map((b) => (
                      <button
                        key={b._id}
                        type="button"
                        onClick={() => handleAddBuildToGroup(b._id)}
                        className="group flex w-full items-center gap-4 rounded-[10px] border border-glass-border p-4 text-left transition-colors hover:border-glass-border-strong hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-glass-border bg-glass-active">
                          {b.imageStorageId ? (
                            <ResolvedImage
                              imageStorageId={b.imageStorageId}
                              alt={b.name}
                              className="h-full w-full object-cover"
                            />
                          ) : b.imageUrl ? (
                            <img
                              src={b.imageUrl}
                              alt={b.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-media-fg-45">
                              <span className="material-symbols-outlined text-xl">palette</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif italic text-lg">{b.name}</p>
                          <p className="truncate text-[9px] uppercase tracking-[0.16em] text-media-fg-55">
                            {b.character || "Original"}
                          </p>
                        </div>
                      </button>
                    ))
                )}
              </div>

              <button
                type="button"
                onClick={() => setBuildPickerOpen(false)}
                className="w-full min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
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
