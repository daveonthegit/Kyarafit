"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, deleteAccount } from "@/lib/auth/auth-client";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { AccountDetailsContent, type UserWithUsername } from "./AccountDetailsContent";

export default function SettingsAccountPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as UserWithUsername | undefined;

  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">Settings</p>
          <h1 className="font-serif text-4xl tracking-tight">Account Details</h1>
        </div>
        <Link href="/settings" className="p-2 -mr-2" aria-label="Back to settings">
          <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
        </Link>
      </header>

      <main className="mt-10">
        {isPending && <p className="text-sm text-kyar-textSecondary">Loading…</p>}
        {!isPending && !user && <p className="text-sm text-kyar-textSecondary">Not signed in.</p>}
        {!isPending && user && (
          <AccountDetailsContent
            user={user}
            onUpdateDisplayName={async (name) => {
              const result = await authClient.updateUser({ name });
              return { error: result?.error ?? null };
            }}
            onDeleteAccount={async () => {
              const result = await deleteAccount();
              if (!result?.error) {
                router.replace("/");
              }
              return { error: result?.error ?? null };
            }}
          />
        )}
      </main>
    </WebAppShell>
  );
}
