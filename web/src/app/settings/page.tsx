"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTier } from "@/lib/api/useTier";
import { formatStorageMb } from "@/lib/utils";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { authClient } from "@/lib/auth/auth-client";

const menuItems: { label: string; href: string }[] = [
  { label: "Account Details", href: "/settings/account" },
  { label: "Subscription Plan", href: "/settings/subscription" },
  { label: "Notification Style", href: "/settings/notifications" },
];

export default function Settings() {
  const router = useRouter();
  const { data: tier, isLoading } = useTier();
  const isFree = tier?.tier === "FREE";

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/home");
  };

  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">System Preferences</p>
          <h1 className="font-serif text-4xl tracking-tight">Settings</h1>
        </div>
        <Link href="/home" className="p-2 -mr-2" aria-label="Back to home">
          <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
        </Link>
      </header>

      <main className="mt-10 space-y-12">
        {!isLoading && tier && (
          <section>
            <h2 className="font-serif text-xl italic mb-6">Backup & storage</h2>
            {tier.storageLimitMb >= 0 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  Storage
                </p>
                <p className="text-sm">
                  {formatStorageMb(tier.currentUsageMb)} / {formatStorageMb(tier.storageLimitMb)}
                </p>
              </div>
            )}
            {tier.storageLimitMb === -1 && (
              <div className="py-3 border-b border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                  Storage
                </p>
                <p className="text-sm">{formatStorageMb(tier.currentUsageMb)} used (unlimited)</p>
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
          {menuItems.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="flex justify-between items-center py-5 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 -mx-2 px-2 rounded"
            >
              <span className="text-[11px] uppercase tracking-widest font-medium">{label}</span>
              <span className="material-symbols-outlined text-sm opacity-30">chevron_right</span>
            </Link>
          ))}
        </section>
        <button
          onClick={handleSignOut}
          className="text-[10px] uppercase tracking-[0.3em] font-semibold text-red-500/80 text-left"
        >
          Sign Out
        </button>
      </main>
    </WebAppShell>
  );
}
