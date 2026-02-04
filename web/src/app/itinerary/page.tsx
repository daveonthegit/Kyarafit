'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';

const IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';

export default function Itinerary() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-6 pt-14 pb-4 border-b border-gray-100 flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] font-medium mb-1.5 opacity-40">Kyarafit Itinerary</p>
          <h1 className="font-serif text-3xl font-bold italic">Anime Expo</h1>
        </div>
        <div className="flex gap-4 mb-1">
          <span className="material-symbols-outlined font-light text-2xl">ios_share</span>
          <button onClick={() => router.back()}>
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
            <div className="w-2/3 relative aspect-[3/4]">
              <Image src={IMG} alt="Look" fill className="object-cover stagger-image" sizes="66vw" />
            </div>
            <div className="w-1/3 flex flex-col justify-end pb-4">
              <p className="text-[11px] uppercase font-bold mb-2">Look 01</p>
              <p className="text-[10px] opacity-60">Arlecchino Full Regalia</p>
            </div>
          </div>
        </div>
      </main>

      <BottomNav active="plan" />
    </div>
  );
}
