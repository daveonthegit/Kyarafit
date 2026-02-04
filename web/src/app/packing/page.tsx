'use client';

import { useState } from 'react';
import { BottomNav } from '@/components/layout/BottomNav';

const packingData = [
  { section: 'Arlecchino', items: ['Custom Wig', 'Tailored Coat', 'Pointed Boots', 'Glove Set'] },
  { section: 'Emergency Kit', items: ['Hot Glue Gun', 'Safety Pins'] },
];

export default function PackingList() {
  const [selectedCon, setSelectedCon] = useState('Anime Expo');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (item: string) => setChecked((prev) => ({ ...prev, [item]: !prev[item] }));

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label opacity-50 mb-1">Logistics</p>
          <h1 className="font-serif text-3xl font-bold italic">Packing List</h1>
        </div>
        <div className="flex flex-col items-end">
          <label className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Convention</label>
          <select
            value={selectedCon}
            onChange={(e) => setSelectedCon(e.target.value)}
            className="text-[10px] uppercase tracking-widest font-bold border-none p-0 focus:ring-0 text-right bg-transparent cursor-pointer"
          >
            <option>Anime Expo</option>
            <option>NYCC</option>
          </select>
        </div>
      </header>

      <main className="px-6 space-y-10">
        {packingData.map(({ section, items }) => (
          <section key={section}>
            <div className="flex justify-between border-b border-black pb-2 mb-6">
              <h2 className="font-serif text-xl font-bold italic">{section}</h2>
              <span className="text-[9px] opacity-40">{items.length} Items</span>
            </div>
            <div className="space-y-5">
              {items.map((item) => (
                <div key={item} className="flex items-center cursor-pointer" onClick={() => toggle(item)}>
                  <span
                    className={`w-4 h-4 mr-4 border border-black flex items-center justify-center ${checked[item] ? 'bg-black' : ''}`}
                  >
                    {checked[item] && <span className="w-2 h-2 bg-white block" />}
                  </span>
                  <label className={`text-[13px] uppercase tracking-wide flex-1 cursor-pointer ${checked[item] ? 'line-through opacity-50' : ''}`}>
                    {item}
                  </label>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      <BottomNav active="packing" />
    </div>
  );
}
