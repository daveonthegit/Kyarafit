"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/layout/BottomNav";

const conventions = [
  { id: "ax", name: "Anime Expo", date: "July 2024", status: "Upcoming" },
  { id: "nycc", name: "NYCC", date: "Oct 2024", status: "Planning" },
];

export default function Planner() {
  const [view, setView] = useState<"daily" | "conventions">("daily");

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-8 pt-16 pb-8">
        <div className="flex gap-6 mb-8">
          <button
            onClick={() => setView("daily")}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold pb-1 ${view === "daily" ? "border-b-2 border-black" : "opacity-30"}`}
          >
            Daily
          </button>
          <button
            onClick={() => setView("conventions")}
            className={`text-[10px] uppercase tracking-[0.2em] font-bold pb-1 ${view === "conventions" ? "border-b-2 border-black" : "opacity-30"}`}
          >
            Conventions
          </button>
        </div>
        {view === "daily" ? (
          <div className="flex items-baseline justify-between">
            <h1 className="font-serif text-5xl font-bold italic tracking-tighter">October 24</h1>
            <span className="text-[11px] uppercase tracking-widest opacity-60">Thursday</span>
          </div>
        ) : (
          <h1 className="font-serif text-5xl font-bold italic tracking-tighter">Circuit</h1>
        )}
      </header>

      <main className="flex-1 px-8">
        {view === "daily" ? (
          <section className="mb-16">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold mb-8 border-b border-black pb-2 inline-block">
              Today&apos;s Priority
            </h2>
            <div className="space-y-12">
              <div className="group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] opacity-30">01</span>
                  <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                </div>
                <h3 className="text-xl font-light tracking-tight">Today&apos;s priority task</h3>
                <p className="text-[11px] uppercase tracking-widest opacity-40 mt-2">
                  Workshop • 2:00 PM
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-10">
            {conventions.map((con) => (
              <div key={con.id} className="border-b border-gray-100 pb-6 group cursor-pointer">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="font-serif text-2xl italic font-bold">{con.name}</h3>
                  <span className="text-[10px] opacity-40">{con.date}</span>
                </div>
                <div className="flex gap-4">
                  <Link
                    href="/itinerary"
                    className="text-[9px] uppercase tracking-widest border border-black/10 px-3 py-1"
                  >
                    Itinerary
                  </Link>
                  <Link
                    href="/packing"
                    className="text-[9px] uppercase tracking-widest border border-black/10 px-3 py-1"
                  >
                    Packing List
                  </Link>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      <BottomNav active="plan" />
    </div>
  );
}
