"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
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
  const builds = useQuery(
    api.builds.listByGroup,
    groupId ? { groupId } : "skip"
  ) ?? [];
  const conventionDays = useQuery(
    api.groupConventionDays.listForGroupWithConventions,
    groupId ? { groupId } : "skip"
  ) ?? [];
  const myConventions = useQuery(api.conventions.list, userId ? { userId } : "skip") ?? [];
  const myBuilds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const setDays = useMutation(api.groupConventionDays.setDays);
  const setBuildGroup = useMutation(api.builds.setGroupId);

  const [conventionPickerOpen, setConventionPickerOpen] = useState(false);
  const [selectedConventionId, setSelectedConventionId] = useState<Id<"conventions"> | null>(null);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [daysPending, setDaysPending] = useState(false);

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
  };

  const handleRemoveBuildFromGroup = async (buildId: Id<"builds">) => {
    if (!groupId || !userId) return;
    await setBuildGroup({ buildId, userId, groupId: null });
  };

  if (!groupId) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Missing group id.</p>
        <Link href="/groups" className="mt-4 text-sm underline">Back to Groups</Link>
      </WebAppShell>
    );
  }

  if (data === undefined) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Loading…</p>
      </WebAppShell>
    );
  }

  if (!group) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Group not found or not visible.</p>
        <Link href="/groups" className="mt-4 text-sm underline">Back to Groups</Link>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <Link href="/groups" className="text-[11px] uppercase tracking-widest text-kyar-textSecondary hover:text-kyar-accent mb-2 inline-block">
            Groups
          </Link>
          <h1 className="font-serif text-4xl tracking-tight">{group.name}</h1>
        </div>
      </header>

      <main className="mt-10 space-y-10">
        {(group.description || group.imageStorageId || group.imageUrl) && (
          <section>
            <div className="flex flex-col sm:flex-row gap-6">
              {(group.imageStorageId || group.imageUrl) && (
                <div className="w-full sm:w-48 aspect-[4/3] rounded-lg overflow-hidden bg-kyar-mutedWarm flex-shrink-0">
                  {group.imageStorageId ? (
                    <ResolvedImage
                      imageStorageId={group.imageStorageId}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img src={group.imageUrl!} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              )}
              {group.description && (
                <p className="text-sm text-kyar-textSecondary whitespace-pre-wrap">{group.description}</p>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-3">Members</h2>
          <ul className="flex flex-wrap gap-3">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 px-3 py-2 rounded-md bg-kyar-mutedWarm">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-kyar-cardBorder">
                  {m.imageStorageId ? (
                    <ResolvedImage imageStorageId={m.imageStorageId} alt="" className="w-full h-full object-cover" />
                  ) : m.image ? (
                    <img src={m.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xs material-symbols-outlined">person</span>
                  )}
                </div>
                <span className="text-sm font-medium">{m.name}</span>
                <span className="text-[11px] text-kyar-textTertiary capitalize">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-3">Convention days</h2>
          <p className="text-sm text-kyar-textSecondary mb-3">
            Select which days of a convention the group is wearing this cosplay.
          </p>
          {conventionDays.length > 0 && (
            <ul className="space-y-2 mb-4">
              {conventionDays.map((c) => (
                <li key={c.conventionId} className="flex items-center justify-between py-2 border-b border-kyar-borderSubtle">
                  <div>
                    <p className="font-medium">{c.conventionName}</p>
                    <p className="text-xs text-kyar-textTertiary">
                      {c.dates.length} day{c.dates.length !== 1 ? "s" : ""} selected: {c.dates.join(", ")}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenConventionPicker(c.conventionId as Id<"conventions">)}
                      className="text-[11px] uppercase tracking-widest text-kyar-accent hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isAdmin && (
            <div>
              <p className="text-[11px] text-kyar-textTertiary mb-2">Add convention (your events):</p>
              <div className="flex flex-wrap gap-2">
                {myConventions
                  .filter((c) => !conventionDays.some((cd) => cd.conventionId === c._id))
                  .map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => handleOpenConventionPicker(c._id)}
                      className="px-3 py-2 text-sm border border-kyar-cardBorder rounded-md hover:border-kyar-accent/50"
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>

        {conventionPickerOpen && selectedConvention && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-kyar-bg rounded-lg shadow-lg max-w-md w-full p-6">
              <h3 className="font-serif text-xl mb-2">{selectedConvention.name}</h3>
              <p className="text-sm text-kyar-textSecondary mb-4">
                Select days the group is wearing this cosplay:
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {datesInRange.map((date) => (
                  <label key={date} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDates.has(date)}
                      onChange={() => toggleDate(date)}
                      className="rounded border-kyar-cardBorder"
                    />
                    <span className="text-sm">
                      {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSaveDays}
                  disabled={daysPending}
                  className="flex-1 bg-black text-white py-2 text-sm font-medium uppercase tracking-wider disabled:opacity-50"
                >
                  {daysPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setConventionPickerOpen(false)}
                  className="px-4 py-2 border border-kyar-border text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-3">Builds in this group</h2>
          {builds.length === 0 ? (
            <p className="text-sm text-kyar-textSecondary">No builds added yet.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {builds.map((b) => (
                <li key={b._id}>
                  <Link
                    href={`/build-detail?id=${b._id}`}
                    className="block border border-kyar-cardBorder rounded-lg overflow-hidden bg-kyar-card hover:border-kyar-accent/50"
                  >
                    <div className="aspect-[4/3] bg-kyar-mutedWarm">
                      {b.imageStorageId ? (
                        <ResolvedImage imageStorageId={b.imageStorageId} alt="" className="w-full h-full object-cover" />
                      ) : b.imageUrl ? (
                        <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-kyar-textTertiary material-symbols-outlined text-4xl">palette</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-medium truncate">{b.name}</p>
                      {b.character && <p className="text-xs text-kyar-textSecondary">{b.character}</p>}
                    </div>
                  </Link>
                  {userId === b.userId && (
                    <button
                      type="button"
                      onClick={() => handleRemoveBuildFromGroup(b._id)}
                      className="mt-1 text-xs text-kyar-textTertiary hover:text-red-600"
                    >
                      Remove from group
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {userId && (
            <div className="mt-4">
              <p className="text-[11px] text-kyar-textTertiary mb-2">Add your build to this group:</p>
              <select
                className="border border-kyar-cardBorder rounded-md px-3 py-2 text-sm"
                value=""
                onChange={(e) => {
                  const id = e.target.value as Id<"builds">;
                  if (id) handleAddBuildToGroup(id);
                }}
              >
                <option value="">Choose a build…</option>
                {myBuilds
                  .filter((b) => !builds.some((gb) => gb._id === b._id))
                  .map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} {b.character ? `(${b.character})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </section>
      </main>
    </WebAppShell>
  );
}
