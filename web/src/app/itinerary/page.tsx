"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import type { Id } from "convex/_generated/dataModel";

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

export default function Itinerary() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conventionIdParam = searchParams.get("conventionId") as Id<"conventions"> | null;
  const { userId } = useCurrentUser();

  const allConventions = useQuery(api.conventions.list, userId ? { userId } : "skip") ?? [];

  const conventionId = useMemo(() => {
    if (conventionIdParam) return conventionIdParam;
    if (allConventions.length > 0) {
      const sorted = [...allConventions].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      return sorted[0]._id;
    }
    return null;
  }, [conventionIdParam, allConventions]);

  const convention = useQuery(api.conventions.get, conventionId ? { id: conventionId } : "skip");
  const plan = useQuery(api.conventions.getPlan, conventionId ? { conventionId } : "skip") ?? [];
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const packingItems =
    useQuery(api.conventions.getPacking, conventionId ? { conventionId } : "skip") ?? [];

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

  const isOffline = typeof window !== "undefined" && !navigator.onLine;
  const lastSyncText = isOffline ? "Offline mode active" : "Last synced: recently";

  if (!conventionId) {
    return (
      <WebAppShell>
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
          <p className="meta-label">Itinerary</p>
        </header>
        <main className="flex-1 pt-10">
          <p className="text-sm text-kyar-textTertiary">
            Please select a convention to view its itinerary.
          </p>
          <Link href="/conventions" className="mt-4 text-sm underline">
            View Conventions
          </Link>
        </main>
      </WebAppShell>
    );
  }

  if (convention === undefined) {
    return (
      <WebAppShell>
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
          <p className="meta-label">Loading...</p>
        </header>
      </WebAppShell>
    );
  }

  if (!convention) {
    return (
      <WebAppShell>
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
          <p className="meta-label">Convention not found</p>
        </header>
        <main className="flex-1 pt-10">
          <Link href="/conventions" className="text-sm underline">
            Back to Conventions
          </Link>
        </main>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle">
        <div className="flex items-center gap-4 mb-2">
          <button type="button" onClick={() => router.back()}>
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </button>
          <p className="meta-label flex-1">Itinerary</p>
          <Link href={`/conventions/${conventionId}`}>
            <span className="material-symbols-outlined font-light text-2xl">calendar_month</span>
          </Link>
        </div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-2xl font-bold italic flex-1">{convention.name}</h1>
          {allConventions.length > 1 && (
            <select
              value={conventionId || ""}
              onChange={(e) => router.push(`/itinerary?conventionId=${e.target.value}`)}
              className="text-xs border border-kyar-borderSubtle px-2 py-1 bg-white"
            >
              {allConventions.map((conv) => (
                <option key={conv._id} value={conv._id}>
                  {conv.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary mt-1.5">
          {isOffline && (
            <span className="material-symbols-outlined text-xs align-middle mr-1">cloud_off</span>
          )}
          {lastSyncText}
        </p>
      </header>

      <main className="flex-1 pt-6 pb-32 space-y-8">
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
          <div className="flex justify-between items-baseline mb-6">
            <h2 className="font-serif text-2xl italic font-bold">Cosplay Timeline</h2>
            <Link
              href={`/conventions/${conventionId}`}
              className="text-[10px] uppercase tracking-wider underline"
            >
              Edit Plan
            </Link>
          </div>

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

                      {build ? (
                        <div className="border border-kyar-borderSubtle p-3 bg-white">
                          <div className="flex gap-3">
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
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-kyar-borderSubtle border-dashed p-3 bg-kyar-muted/30">
                          <p className="text-xs text-kyar-textTertiary italic">Rest day</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-kyar-borderSubtle pt-8">
          <h2 className="font-serif text-2xl italic font-bold mb-4">Logistics</h2>
          <div className="border border-kyar-borderSubtle p-4 mb-3">
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
                No accommodation details added yet
              </p>
            )}
          </div>
          <p className="text-[9px] uppercase tracking-wider text-kyar-textTertiary text-center mt-6">
            {lastSyncText}
          </p>
        </div>
      </main>
    </WebAppShell>
  );
}
