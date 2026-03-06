"use client";

import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";

export default function SettingsNotificationsPage() {
  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">Settings</p>
          <h1 className="font-serif text-4xl tracking-tight">Notification Style</h1>
        </div>
        <Link href="/settings" className="p-2 -mr-2" aria-label="Back to settings">
          <span className="material-symbols-outlined font-thin text-2xl">close</span>
        </Link>
      </header>

      <main className="mt-10">
        <section>
          <p className="text-sm text-kyar-textSecondary" data-testid="notifications-placeholder">
            Notification preferences coming soon.
          </p>
        </section>
      </main>
    </WebAppShell>
  );
}
