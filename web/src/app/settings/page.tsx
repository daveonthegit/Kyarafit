'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

const menuItems = ['Account Details', 'Subscription Plan', 'Notification Style'];

export default function Settings() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="px-8 pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">System Preferences</p>
          <h1 className="font-serif text-4xl tracking-tight">Settings</h1>
        </div>
        <button onClick={() => router.back()} className="p-2 -mr-2">
          <span className="material-symbols-outlined font-thin text-2xl">close</span>
        </button>
      </header>

      <main className="px-8 mt-10 space-y-12">
        <section>
          <h2 className="font-serif text-xl italic mb-6">Profile & Identity</h2>
          {menuItems.map((item) => (
            <div key={item} className="flex justify-between items-center py-5 border-b border-gray-100 cursor-pointer">
              <span className="text-[11px] uppercase tracking-widest font-medium">{item}</span>
              <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            </div>
          ))}
        </section>
        <Link href="/" className="text-[10px] uppercase tracking-[0.3em] font-semibold text-red-500/80 block">
          Sign Out of Device
        </Link>
      </main>
    </div>
  );
}
