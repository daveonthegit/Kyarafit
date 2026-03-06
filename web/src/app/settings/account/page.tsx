"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { WebAppShell } from "@/components/layout/WebAppShell";

export default function SettingsAccountPage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">Settings</p>
          <h1 className="font-serif text-4xl tracking-tight">Account Details</h1>
        </div>
        <Link href="/settings" className="p-2 -mr-2" aria-label="Back to settings">
          <span className="material-symbols-outlined font-thin text-2xl">close</span>
        </Link>
      </header>

      <main className="mt-10">
        {isPending && <p className="text-sm text-kyar-textSecondary">Loading…</p>}
        {!isPending && !user && <p className="text-sm text-kyar-textSecondary">Not signed in.</p>}
        {!isPending && user && (
          <section className="space-y-6">
            <div className="py-3 border-b border-gray-100">
              <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                Email
              </p>
              <p className="text-sm" data-testid="account-email">
                {user.email ?? "—"}
              </p>
            </div>
            <div className="py-3 border-b border-gray-100">
              <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
                Display name
              </p>
              <p className="text-sm" data-testid="account-name">
                {user.name ?? "—"}
              </p>
            </div>
            <div className="pt-4">
              <Link
                href="/auth/reset-password"
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
              >
                Change password
              </Link>
              <p className="mt-1 text-[11px] text-kyar-textSecondary">
                We’ll send you a link to set a new password.
              </p>
            </div>
          </section>
        )}
      </main>
    </WebAppShell>
  );
}
