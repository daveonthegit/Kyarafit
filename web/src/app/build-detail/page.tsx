'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';

const BUILD_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';

const materials = [
  { name: 'Worbla Sheet (Large)', cost: 85.0, status: 'Acquired' },
  { name: 'Raw Silk Fabric (4yd)', cost: 120.0, status: 'Acquired' },
  { name: 'EVA Foam 5mm', cost: 45.5, status: 'Planned' },
];

export default function BuildDetail() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 flex justify-between items-center">
        <button onClick={() => router.back()}>
          <span className="material-symbols-outlined font-light text-2xl">arrow_back_ios</span>
        </button>
        <span className="meta-label">Build Profile</span>
        <span className="material-symbols-outlined font-light text-2xl">more_horiz</span>
      </header>

      <main className="mt-24">
        <section className="px-6 mb-12">
          <div className="aspect-[4/5] w-full overflow-hidden mb-8 relative">
            <Image src={BUILD_IMG} alt="Arlecchino" fill className="object-cover" sizes="100vw" />
          </div>
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="meta-label mb-2">Character Project</p>
              <h1 className="font-serif text-4xl font-normal italic">Arlecchino</h1>
            </div>
            <div className="text-right">
              <p className="meta-label">Edition</p>
              <p className="text-xs uppercase font-medium tracking-widest">Spring 2024</p>
            </div>
          </div>
          <div className="grid grid-cols-2 py-6 border-y border-black/5">
            <div className="px-2">
              <p className="meta-label">Construction</p>
              <p className="text-xs uppercase mt-1 font-medium">85% Complete</p>
            </div>
            <div className="px-2 border-l border-black/5">
              <p className="meta-label">Financials</p>
              <p className="text-xs uppercase mt-1 font-medium">Spent: $842.10</p>
              <p className="text-[9px] opacity-40 italic">Limit: $1,200.00</p>
            </div>
          </div>
        </section>

        <section className="px-6 mb-12">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-serif text-xl italic">Bill of Materials</h2>
            <button className="text-[9px] uppercase tracking-widest border-b border-black">Add Expense</button>
          </div>
          <div className="space-y-6">
            {materials.map((item, i) => (
              <div key={i} className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <p className="text-xs uppercase tracking-widest font-light">{item.name}</p>
                  <p className="text-[9px] opacity-40 mt-1">{item.status}</p>
                </div>
                <span className="text-[11px] font-bold">${item.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav active="builds" />
    </div>
  );
}
