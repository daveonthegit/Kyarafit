'use client';

import { useRouter } from 'next/navigation';

export default function AddItem() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 flex justify-between items-center">
        <button onClick={() => router.back()}>
          <span className="material-symbols-outlined font-light text-2xl">close</span>
        </button>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.4em] font-medium opacity-40">Kyarafit</p>
          <h1 className="font-serif text-xl font-bold italic">New Item</h1>
        </div>
        <div className="w-6" />
      </header>

      <main className="px-6 pb-32 space-y-10">
        <div className="aspect-[3/4] w-full bg-[#f9f9f9] flex flex-col items-center justify-center border border-dashed border-gray-200 group cursor-pointer mt-4">
          <span className="material-symbols-outlined text-3xl font-light opacity-20">add_a_photo</span>
          <p className="text-[10px] uppercase tracking-widest mt-4 opacity-40">Upload Reference</p>
        </div>
        <div className="space-y-10">
          {['Item Name', 'Category', 'Tags'].map((label) => (
            <div key={label} className="flex flex-col">
              <label className="text-[10px] uppercase tracking-widest font-bold mb-2">{label}</label>
              <input
                className="border-0 border-b border-black px-0 py-2 text-sm bg-transparent focus:outline-none focus:border-[#1152d4] focus:ring-0"
                type="text"
                placeholder={`Enter ${label}...`}
              />
            </div>
          ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
        <button
          onClick={() => router.back()}
          className="w-full bg-black text-white py-5 text-[11px] uppercase tracking-[0.3em] font-bold shadow-sm"
        >
          Save Item
        </button>
      </div>
    </div>
  );
}
