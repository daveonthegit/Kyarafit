import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingAdd } from '@/components/layout/FloatingAdd';

const BUILD_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';

export default function Builds() {
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

      <nav className="sticky top-[108px] z-30 bg-white/90 backdrop-blur-md pt-2 pb-6 flex gap-8 px-6 overflow-x-auto no-scrollbar">
        <button className="text-[11px] uppercase tracking-widest font-semibold border-b border-black shrink-0">In Progress</button>
        <button className="text-[11px] uppercase tracking-widest font-normal opacity-30 shrink-0">Completed</button>
      </nav>

      <main className="flex-1 px-6 space-y-16 mt-6">
        <Link href="/build-detail" className="block cursor-pointer">
          <div className="aspect-[2/3] w-full overflow-hidden bg-gray-50 mb-6 relative">
            <Image src={BUILD_IMG} alt="Arlecchino" fill className="object-cover" sizes="100vw" />
            <div className="absolute top-4 right-4 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm">
              Budget: $840 / $1200
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <h2 className="font-serif text-2xl font-bold italic tracking-tight">Arlecchino</h2>
              <span className="text-[10px] opacity-40">PROJ 012</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] uppercase tracking-widest">
                <span>Construction Progress</span>
                <span>85%</span>
              </div>
              <div className="h-[1px] bg-gray-100 w-full">
                <div className="h-full bg-black w-[85%]" />
              </div>
            </div>
          </div>
        </Link>
      </main>

      <FloatingAdd />
      <BottomNav active="builds" />
    </div>
  );
}
