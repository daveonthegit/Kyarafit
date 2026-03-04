"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { ResolvedImage } from "@/components/ui/ResolvedImage";

type TabFilter = "current" | "archived" | "planning" | "completed";

export default function BuildsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("current");
  const { userId } = useCurrentUser();
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const isLoading = builds === undefined;

  const getStatusForTab = (tab: TabFilter): BuildStatus | null => {
    switch (tab) {
      case "current":
        return "wip";
      case "planning":
        return "idea";
      case "completed":
        return "ready";
      case "archived":
        return null;
    }
  };

  const filteredBuilds = builds.filter((b) => {
    const targetStatus = getStatusForTab(activeTab);
    if (targetStatus === null) return false;
    return b.status === targetStatus;
  });

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-6 pt-14 pb-4 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex justify-between items-end">
          <div>
            <p className="meta-label mb-1 opacity-40">Portfolio</p>
            <h1 className="font-serif text-3xl font-bold tracking-tight italic">My Builds</h1>
          </div>
          <Link href="/closet" className="flex items-center gap-2 border border-black px-3 py-1">
            <span className="material-symbols-outlined font-light text-sm">inventory_2</span>
            <span className="text-[9px] uppercase tracking-widest font-bold">Closet</span>
          </Link>
        </div>
      </header>

      <nav className="sticky top-[108px] z-30 bg-white/90 backdrop-blur-md pt-2 pb-6">
        <div className="flex gap-8 px-6 overflow-x-auto no-scrollbar">
          {(["current", "archived", "planning", "completed"] as TabFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[11px] uppercase tracking-widest shrink-0 relative ${
                activeTab === tab
                  ? "font-semibold after:content-[''] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-[1px] after:bg-black"
                  : "font-normal opacity-30"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-6 pb-32 mt-6">
        {isLoading && <p className="meta-label">Loading...</p>}
        {!isLoading && builds.length === 0 && (
          <p className="text-sm text-kyar-meta">
            No builds yet. Create one to link closet items and use them in convention packing.
          </p>
        )}
        {!isLoading && filteredBuilds.length === 0 && builds.length > 0 && (
          <p className="text-sm text-kyar-textTertiary">No builds in this category.</p>
        )}
        <div className="space-y-16">
          {filteredBuilds.map((b, index) => {
            const projectNumber = String(index + 1).padStart(3, "0");
            const progress =
              b.tasksTotal > 0 ? Math.round((b.tasksChecked / b.tasksTotal) * 100) : 0;

            return (
              <section key={b._id}>
                <div className="aspect-[2/3] w-full overflow-hidden bg-gray-50 mb-6">
                  {b.imageStorageId || b.imageUrl ? (
                    <ResolvedImage
                      imageStorageId={b.imageStorageId}
                      imageUrl={b.imageUrl}
                      alt={b.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                      <span className="material-symbols-outlined text-6xl">image</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-baseline">
                    <h2 className="font-serif text-2xl font-bold italic tracking-tight">
                      {b.name}
                    </h2>
                    <span className="text-[10px] font-medium tracking-[0.2em] opacity-40 uppercase">
                      Project {projectNumber}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-end text-[9px] uppercase tracking-[0.2em] font-medium">
                      <span>Construction Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-[1px] bg-gray-200 w-full">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex gap-4">
                      <span className="text-[10px] uppercase tracking-widest opacity-60">
                        {b.status}
                      </span>
                      {b.character && (
                        <span className="text-[10px] uppercase tracking-widest opacity-60">
                          {b.character}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/build-detail?id=${b._id}`}
                      className="text-[11px] font-medium underline underline-offset-4 tracking-tighter hover:opacity-70"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <FloatingAdd href="/builds/new" />
      <BottomNav active="builds" />
    </div>
  );
}
