'use client';

import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

export default function Itinerary() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-6 pt-14 pb-4 border-b border-gray-100 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] font-medium mb-1.5 opacity-40">Kyarafit Itinerary</p>
          <h1 className="font-serif text-3xl font-bold italic">Convention day</h1>
        </div>
        <div className="flex gap-4 mb-1">
          <span className="material-symbols-outlined font-light text-2xl">ios_share</span>
          <button type="button" onClick={() => router.back()}>
            <span className="material-symbols-outlined font-light text-2xl">close</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pt-10 pb-32 space-y-20">
        <div className="relative">
          <div className="flex justify-between items-baseline mb-6">
            <h2 className="font-serif text-5xl italic font-bold">Day 1</h2>
            <span className="text-[10px] uppercase border border-black/10 px-2 py-1">Active</span>
          </div>
          <div className="flex gap-6">
            <div className="w-2/3 relative aspect-[3/4] bg-kyar-muted flex items-center justify-center border border-kyar-borderSubtle">
              <span className="material-symbols-outlined text-5xl text-kyar-textTertiary">image</span>
            </div>
            <div className="w-1/3 flex flex-col justify-end pb-4">
              <p className="text-[11px] uppercase font-bold mb-2">Look 01</p>
              <p className="text-[10px] opacity-60">Assign a build from your convention plan</p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav active="plan" />
    </div>
  );
}
