import Link from 'next/link';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingAdd } from '@/components/layout/FloatingAdd';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="pt-14 px-8 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-1">Kyarafit</p>
          <h1 className="font-serif text-4xl font-normal italic tracking-tight">The Lookbook</h1>
        </div>
        <div className="flex gap-4 mb-1">
          <span className="material-symbols-outlined font-light text-2xl cursor-pointer">search</span>
          <Link href="/settings" className="material-symbols-outlined font-light text-2xl cursor-pointer">menu</Link>
        </div>
      </header>

      <main className="flex-1 px-8">
        <section className="mb-12">
          <div className="w-full aspect-[4/5] bg-kyar-muted flex items-center justify-center border border-kyar-borderSubtle">
            <span className="material-symbols-outlined text-4xl text-kyar-textTertiary">photo_library</span>
          </div>
          <div className="mt-6 flex justify-between items-end">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-light mb-1 text-kyar-meta">Current Focus</p>
              <p className="font-serif text-2xl italic font-normal text-kyar-textTertiary">Add builds to feature here</p>
            </div>
            <Link href="/builds" className="text-[10px] uppercase tracking-widest border border-black px-3 py-1">View Builds</Link>
          </div>
        </section>

        <section className="border-t border-black/5 pt-6">
          <div className="flex justify-between items-baseline mb-4">
            <h3 className="text-[11px] uppercase tracking-[0.3em] font-semibold">Quick links</h3>
          </div>
          <div className="flex flex-col gap-4">
            <Link href="/builds" className="font-serif text-xl italic border-b border-kyar-borderSubtle pb-3">
              My Builds
            </Link>
            <Link href="/conventions" className="font-serif text-xl italic border-b border-kyar-borderSubtle pb-3">
              Conventions
            </Link>
            <Link href="/closet" className="font-serif text-xl italic border-b border-kyar-borderSubtle pb-3">
              Closet
            </Link>
          </div>
        </section>
      </main>

      <FloatingAdd />
      <BottomNav active="home" />
    </div>
  );
}
