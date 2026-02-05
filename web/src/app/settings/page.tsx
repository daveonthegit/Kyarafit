"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTier } from "@/lib/api/useTier";
import { signOut } from "@/lib/auth/client";

const menuItems = ["Account Details", "Subscription Plan", "Notification Style"];

export default function Settings() {
  const router = useRouter();
  const { data: tier, isLoading } = useTier();
  const isFree = tier?.tier === "FREE";

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

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
        {!isLoading && tier && (
          <section>
            <h2 className="font-serif text-xl italic mb-6">Backup & storage</h2>
            {tier.storageLimitMb >= 0 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  Storage
                </p>
                <p className="text-sm">
                  {tier.currentUsageMb} MB / {tier.storageLimitMb} MB
                </p>
              </div>
            )}
            {tier.storageLimitMb === -1 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  Storage
                </p>
                <p className="text-sm">{tier.currentUsageMb} MB used (unlimited)</p>
              </div>
            )}
            {isFree && (
              <p className="mt-3 text-[11px] text-kyar-textSecondary">
                Upgrade for backup and export.
              </p>
            )}
          </section>
        )}
        <section>
          <h2 className="font-serif text-xl italic mb-6">Profile & Identity</h2>
          {menuItems.map((item) => (
            <div
              key={item}
              className="flex justify-between items-center py-5 border-b border-gray-100 cursor-pointer"
            >
              <span className="text-[11px] uppercase tracking-widest font-medium">{item}</span>
              <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            </div>
          ))}
        </section>
        <button
          onClick={handleSignOut}
          className="text-[10px] uppercase tracking-[0.3em] font-semibold text-red-500/80 text-left"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
}
