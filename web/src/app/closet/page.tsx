'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingAdd } from '@/components/layout/FloatingAdd';
import { fetchClosetItems } from '@/lib/api/closet';
import type { ClosetItem } from '@kyarafit/design-system/types';

const CATEGORIES = ['All Items', 'Wig', 'Prop', 'Armor', 'Garment', 'Shoe', 'Material', 'Other'];

export default function ClosetPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['closet', 'items'],
    queryFn: fetchClosetItems,
  });

  const [activeCategory, setActiveCategory] = useState('All Items');
  const filtered =
    activeCategory === 'All Items'
      ? items
      : items.filter((i) => i.category.toLowerCase() === activeCategory.toLowerCase());

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/builds">
            <span className="material-symbols-outlined font-light">arrow_back</span>
          </Link>
          <p className="meta-label">Builds / Closet</p>
        </div>
        <div className="flex justify-between items-end">
          <h1 className="font-serif text-3xl font-bold tracking-tight italic">The Closet</h1>
          <button className="mb-1" type="button" aria-label="Search">
            <span className="material-symbols-outlined font-light text-2xl">search</span>
          </button>
        </div>
      </header>

      <nav className="sticky top-[128px] z-30 bg-white/95 backdrop-blur-sm pt-4 pb-6 border-b border-kyar-borderSubtle">
        <div className="flex gap-8 px-6 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`text-[11px] uppercase tracking-widest shrink-0 ${
                activeCategory === cat ? 'font-semibold border-b border-black' : 'font-normal opacity-40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 px-4 py-6 grid grid-cols-2 gap-3">
        {isLoading && <p className="col-span-2 text-[12px] opacity-50">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="col-span-2 text-[12px] opacity-50">No items yet.</p>
        )}
        {filtered.map((item) => (
          <ClosetCard key={item.id} item={item} />
        ))}
      </main>

      <FloatingAdd href="/closet/new" />
      <BottomNav active="builds" />
    </div>
  );
}

function ClosetCard({ item }: { item: ClosetItem }) {
  const src = item.imageUrl || item.imageLocalUri;
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square bg-kyar-muted overflow-hidden">
        {src ? (
          <Image
            src={src}
            alt={item.name}
            width={300}
            height={300}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
            <span className="material-symbols-outlined text-4xl">checkroom</span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-start">
        <h3 className="text-[10px] uppercase tracking-wider font-semibold">{item.name}</h3>
        <span className="text-[9px] opacity-40">{item.category}</span>
      </div>
    </div>
  );
}

