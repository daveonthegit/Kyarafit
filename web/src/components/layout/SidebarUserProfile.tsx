"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { authClient } from "@/lib/auth/auth-client";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { api } from "convex/_generated/api";

type SidebarUserProfileProps = {
  collapsed: boolean;
};

export function SidebarUserProfile({ collapsed }: SidebarUserProfileProps) {
  const { data: session, isPending } = authClient.useSession();
  const externalId = session?.user?.id ?? null;
  const convexUser = useQuery(api.users.getByExternalId, externalId ? { externalId } : "skip");

  const user = session?.user;
  const displayName = user?.name ?? user?.email ?? "Account";
  const username =
    (user as { displayUsername?: string; username?: string } | undefined)?.displayUsername ??
    (user as { username?: string } | undefined)?.username ??
    null;
  const profileImageStorageId = convexUser?.imageStorageId ?? undefined;
  const profileImageUrl =
    !profileImageStorageId && convexUser?.image ? convexUser.image : (user?.image ?? undefined);

  if (isPending || !user) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-sm py-2.5 px-3 min-h-[44px] border border-transparent ${
        collapsed ? "justify-center px-0" : ""
      }`}
    >
      <Link
        href="/settings/account"
        className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden border border-kyar-cardBorder bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
        aria-label="Go to account details"
      >
        {profileImageStorageId ? (
          <ResolvedImage
            imageStorageId={profileImageStorageId}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : profileImageUrl ? (
          <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-2xl text-kyar-textTertiary w-full h-full flex items-center justify-center">
            person
          </span>
        )}
      </Link>
      {!collapsed && (
        <Link
          href="/settings/account"
          className="flex-1 min-w-0 flex flex-col items-start justify-center"
        >
          <span className="text-sm font-medium text-kyar-text truncate w-full text-left">
            {displayName}
          </span>
          {username != null && username !== "" && (
            <span className="text-xs text-kyar-textTertiary truncate w-full text-left">
              @{username}
            </span>
          )}
        </Link>
      )}
    </div>
  );
}
