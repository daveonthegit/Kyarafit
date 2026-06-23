"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
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

  const handleOpenConventionPicker = (conventionId: Id<"conventions">) => {
    setSelectedConventionId(conventionId);
    const existing = conventionDays.find((c) => c.conventionId === conventionId);
    setSelectedDates(existing ? new Set(existing.dates) : new Set());
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
      <WebAppShell>
        <p className="meta-label pt-12">Missing group id.</p>
        <Link href="/groups" className="mt-4 text-sm underline">
          Back to Groups
        </Link>
      </WebAppShell>
    );
  }

  if (data === undefined) {
    return (
      <WebAppShell>
        <OnlineOnlyBanner className="mt-4" />
        <p className="meta-label pt-12">Loading…</p>
      </WebAppShell>
    );
  }

  if (!group) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Group not found or not visible.</p>
        <Link href="/groups" className="mt-4 text-sm underline">
          Back to Groups
        </Link>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <OnlineOnlyBanner className="mt-4" />
      <header className="sticky top-0 z-40 bg-kyar-bg/95 backdrop-blur-sm pt-4 sm:pt-6 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/groups"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-text focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </Link>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kyar-meta font-mono">
            Group
          </p>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] xl:grid-cols-[minmax(0,500px)_1fr] gap-8 lg:gap-16 max-w-6xl mx-auto">
          {/* Left Column (Sticky Image) */}
          <div className="lg:sticky lg:top-24 h-[60vh] lg:h-[calc(100vh-8rem)]">
            <div className="w-full h-full bg-kyar-muted overflow-hidden rounded-2xl shadow-soft relative">
              {group.imageStorageId || group.imageUrl ? (
                <ResolvedImage
                  imageStorageId={group.imageStorageId}
                  imageUrl={group.imageUrl}
                  alt={group.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                  <span className="material-symbols-outlined text-6xl">group</span>
                </div>
              )}
              <div className="absolute bottom-6 left-6 rounded-sm border border-white/20 bg-black/55 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-kyar-media-fg backdrop-blur-sm">
                GROUP COSPLAY
              </div>
            </div>
          </div>

          {/* Right Column (Details) */}
          <div className="flex flex-col pt-4 lg:pt-8 min-w-0 pb-32">
            <div className="flex justify-between items-start gap-4 mb-8">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-meta leading-relaxed">
                {group.visibility} GROUP
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-kyar-text shrink-0 text-right">
                {members.length} MEMBER{members.length !== 1 && "S"}
              </p>
            </div>

            <h1 className="font-serif text-5xl lg:text-6xl font-normal italic tracking-tight mb-8 leading-none">
              {group.name}
            </h1>

            {group.description && (
              <p className="text-sm text-kyar-text leading-relaxed mb-16 whitespace-pre-wrap">
                {group.description}
              </p>
            )}

            {/* Members Section */}
            <section className="mb-16">
              <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                Members
              </h2>
              <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-soft group/member bg-kyar-muted"
                  >
                    {m.imageStorageId ? (
                      <ResolvedImage
                        imageStorageId={m.imageStorageId}
                        alt={m.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/member:scale-105"
                      />
                    ) : m.image ? (
                      <img
                        src={m.image}
                        alt={m.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/member:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary">
                        <span className="material-symbols-outlined text-3xl">person</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-kyar-media-scrim" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-kyar-media-fg text-[10px] font-bold uppercase tracking-widest truncate">
                        {m.name}
                      </p>
                      <p className="text-kyar-media-fg-soft text-[8px] uppercase tracking-[0.2em]">
                        {m.role}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Conventions Section */}
            <section className="mb-16">
              <div className="flex justify-between items-baseline border-b border-kyar-borderSubtle pb-3 mb-6">
                <h2 className="text-[9px] font-bold uppercase tracking-[0.2em]">
                  Associated Conventions
                </h2>
                {isAdmin && (
                  <div className="relative group/addcon">
                    <button
                      type="button"
                      className="text-[9px] font-bold uppercase tracking-widest text-kyar-accent hover:text-kyar-text transition-colors"
                    >
                      + ADD
                    </button>
                    {/* Hover dropdown for conventions */}
                    <div className="absolute right-0 top-full mt-2 w-48 bg-kyar-surface border border-kyar-borderSubtle rounded-xl shadow-xl opacity-0 invisible group-hover/addcon:opacity-100 group-hover/addcon:visible transition-all z-20 overflow-hidden">
                      {myConventions.filter(
                        (c) => !conventionDays.some((cd) => cd.conventionId === c._id)
                      ).length === 0 ? (
                        <div className="p-4 text-xs text-kyar-textTertiary text-center italic">
                          No new conventions available.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          {myConventions
                            .filter((c) => !conventionDays.some((cd) => cd.conventionId === c._id))
                            .map((c) => (
                              <button
                                key={c._id}
                                type="button"
                                onClick={() => handleOpenConventionPicker(c._id)}
                                className="w-full text-left px-4 py-3 text-xs hover:bg-kyar-muted transition-colors border-b border-kyar-borderSubtle last:border-0"
                              >
                                {c.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {conventionDays.length === 0 ? (
                <p className="text-sm text-kyar-textTertiary italic">No conventions linked.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {conventionDays.map((c) => (
                    <li
                      key={c.conventionId}
                      className="relative p-5 rounded-2xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft group/con overflow-hidden"
                    >
                      <div className="relative z-10 flex flex-col h-full justify-between min-h-[100px]">
                        <div>
                          <p className="font-serif italic font-bold text-xl leading-tight mb-2">
                            {c.conventionName}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {c.dates.map((date) => (
                              <span
                                key={date}
                                className="px-2 py-1 bg-kyar-muted text-[8px] font-bold uppercase tracking-widest rounded-sm"
                              >
                                {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            ))}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="mt-4 self-start">
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenConventionPicker(c.conventionId as Id<"conventions">)
                              }
                              className="text-[9px] font-bold uppercase tracking-widest text-kyar-meta hover:text-kyar-accent transition-colors"
                            >
                              EDIT DAYS
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Builds Section */}
            <section>
              <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
                Builds in this group
              </h2>
              {builds.length === 0 ? (
                <p className="text-sm text-kyar-textTertiary italic">No builds added yet.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {builds.map((b) => (
                    <li key={b._id} className="relative">
                      <Link
                        href={`/build-detail/${b._id}`}
                        className="block relative aspect-[4/3] w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all group/build"
                      >
                        {b.imageStorageId ? (
                          <ResolvedImage
                            imageStorageId={b.imageStorageId}
                            alt={b.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/build:scale-105"
                          />
                        ) : b.imageUrl ? (
                          <img
                            src={b.imageUrl}
                            alt={b.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/build:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary transition-transform duration-700 group-hover/build:scale-105">
                            <span className="material-symbols-outlined text-6xl">palette</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-kyar-media-scrim transition-colors duration-300" />

                        <div className="absolute inset-0 p-5 flex flex-col justify-end text-kyar-media-fg">
                          <div className="flex justify-between items-end gap-2">
                            <div className="flex-1 min-w-0">
                              {b.character && (
                                <span className="text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase block mb-1">
                                  {b.character}
                                </span>
                              )}
                              <h3 className="font-serif text-2xl lg:text-3xl font-normal italic tracking-tight leading-none truncate text-kyar-media-fg drop-shadow-md transition-opacity group-hover/build:opacity-90">
                                {b.name}
                              </h3>
                            </div>
                          </div>
                        </div>
                      </Link>
                      {userId === b.userId && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBuildFromGroup(b._id)}
                          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-kyar-media-fg backdrop-blur-sm transition-colors hover:bg-red-600"
                          aria-label="Remove from group"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Floating Action Bar */}
            {userId && (
              <div className="fixed bottom-0 right-0 left-0 lg:left-[auto] lg:w-[calc(100%-minmax(0,400px)-4rem)] xl:w-[calc(100%-minmax(0,500px)-4rem)] max-w-6xl mx-auto p-4 lg:p-8 flex justify-end gap-3 pointer-events-none z-30">
                <div className="pointer-events-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setBuildPickerOpen(true)}
                    className="px-8 py-4 bg-kyar-text text-kyar-bg text-[9px] font-bold uppercase tracking-[0.2em] shadow-xl hover:bg-kyar-text/90 transition-colors rounded-full"
                  >
                    ADD MY BUILD
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: group.name,
                          url: window.location.href,
                        });
                      }
                    }}
                    className="w-12 h-12 rounded-full bg-kyar-surface text-kyar-text flex items-center justify-center border border-kyar-borderSubtle shadow-soft hover:bg-kyar-muted transition-colors"
                    aria-label="Share"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {conventionPickerOpen && selectedConvention && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-kyar-text/40 backdrop-blur-sm">
          <div className="bg-kyar-surface rounded-3xl shadow-2xl border border-kyar-borderSubtle max-w-md w-full p-6 sm:p-8">
            <h3 className="font-serif text-3xl font-bold italic mb-2 text-center">
              {selectedConvention.name}
            </h3>
            <p className="text-sm text-kyar-textSecondary mb-8 text-center">
              Select days the group is wearing this cosplay:
            </p>
            <div className="flex flex-col gap-3 mb-8 max-h-[40vh] overflow-y-auto">
              {datesInRange.map((date) => (
                <label
                  key={date}
                  className="flex items-center gap-4 cursor-pointer group p-3 rounded-xl border border-kyar-borderSubtle hover:border-kyar-text transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDates.has(date)}
                    onChange={() => toggleDate(date)}
                    className="w-5 h-5 rounded-full border-2 border-kyar-borderSubtle text-kyar-text focus:ring-kyar-text focus:ring-offset-0 transition-colors cursor-pointer checked:border-kyar-text"
                  />
                  <div>
                    <span className="block text-sm font-medium">
                      {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                        weekday: "long",
                      })}
                    </span>
                    <span className="block text-[10px] text-kyar-textTertiary uppercase tracking-widest">
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
                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-kyar-muted rounded-full transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSaveDays}
                disabled={daysPending}
                className="flex-1 bg-kyar-text text-kyar-bg rounded-full py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-kyar-text/90 transition-colors shadow-md"
              >
                {daysPending ? "SAVING…" : "SAVE DAYS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {buildPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-kyar-text/40 backdrop-blur-sm">
          <div className="bg-kyar-surface rounded-3xl shadow-2xl border border-kyar-borderSubtle max-w-md w-full p-6 sm:p-8">
            <h3 className="font-serif text-3xl font-bold italic mb-6 text-center">Select Build</h3>

            <div className="max-h-[50vh] overflow-y-auto space-y-2 mb-8">
              {myBuilds.filter((b) => !builds.some((gb) => gb._id === b._id)).length === 0 ? (
                <p className="text-center text-sm text-kyar-textTertiary py-4">
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
                      className="w-full text-left p-4 rounded-xl border border-kyar-borderSubtle hover:border-kyar-text hover:shadow-md transition-all flex items-center gap-4 group"
                    >
                      <div className="w-12 h-16 bg-kyar-muted rounded-lg overflow-hidden shrink-0">
                        {b.imageStorageId ? (
                          <ResolvedImage
                            imageStorageId={b.imageStorageId}
                            alt={b.name}
                            className="w-full h-full object-cover"
                          />
                        ) : b.imageUrl ? (
                          <img
                            src={b.imageUrl}
                            alt={b.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                            <span className="material-symbols-outlined text-xl">palette</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif italic font-bold text-lg truncate group-hover:text-kyar-accent transition-colors">
                          {b.name}
                        </p>
                        <p className="text-[9px] uppercase tracking-widest text-kyar-textTertiary truncate">
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
