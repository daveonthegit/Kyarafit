"use client";

import { useRouter } from "next/navigation";
import { authClient, deleteAccount } from "@/lib/auth/auth-client";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { AccountDetailsContent, type UserWithUsername } from "./AccountDetailsContent";

export default function SettingsAccountPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as UserWithUsername | undefined;

  return (
    <SettingsGlassShell eyebrow="Settings" title="Account details">
      {isPending && <p className="text-sm text-media-fg-70">Loading…</p>}
      {!isPending && !user && <p className="text-sm text-media-fg-70">Not signed in.</p>}
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
    </SettingsGlassShell>
  );
}
