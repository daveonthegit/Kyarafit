'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingAdd } from '@/components/layout/FloatingAdd';

interface ClosetItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  tags: string[];
}

const CATEGORIES = ['All Items', 'Wigs', 'Props', 'Materials'];

export default function Closet() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All Items');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetch(`${apiUrl}/closet/items`)
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiUrl]);

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-gray-50">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/builds">
            <span className="material-symbols-outlined font-light">arrow_back</span>
          </Link>
          <p className="meta-label">Builds / Closet</p>
        </div>
        <div className="flex justify-between items-end">
          <h1 className="font-serif text-3xl font-bold tracking-tight italic">The Closet</h1>
          <button className="mb-1">
            <span className="material-symbols-outlined font-light text-2xl">search</span>
          </button>
        </div>
      </header>

      <nav className="sticky top-[128px] z-30 bg-white/95 backdrop-blur-sm pt-4 pb-6 border-b border-gray-50">
        <div className="flex gap-8 px-6 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
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
        {loading && <p className="col-span-2 text-[12px] opacity-50">Loading…</p>}
        {!loading && items.length === 0 && <p className="col-span-2 text-[12px] opacity-50">No items yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2">
            <div className="aspect-square bg-gray-50 overflow-hidden">
              <Image src={item.imageUrl} alt={item.name} width={300} height={300} className="w-full h-full object-cover" />
            </div>
            <div className="flex justify-between items-start">
              <h3 className="text-[10px] uppercase tracking-wider font-semibold">{item.name}</h3>
              <span className="text-[9px] opacity-40">$45.00</span>
            </div>
          </div>
        ))}
      </main>

      <FloatingAdd />
      <BottomNav active="builds" />
    </div>
  );
}
