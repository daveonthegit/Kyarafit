"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { authClient } from "@/lib/auth/auth-client";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { api } from "convex/_generated/api";
import { cn } from "@/lib/utils";

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
    convexUser?.username ??
    null;
  const profileIsPublic = convexUser?.profileVisibility === "public";
  const profileImageStorageId = convexUser?.imageStorageId ?? undefined;
  const profileImageUrl =
    !profileImageStorageId && convexUser?.image ? convexUser.image : (user?.image ?? undefined);

  if (isPending || !user) return null;

  return (
    <div
      className={cn(
        "flex items-center rounded-sm py-2.5 min-h-[44px] border border-transparent transition-[gap,padding] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
        collapsed ? "justify-center gap-0 px-0" : "gap-3 px-3"
      )}
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
      <div
        className={cn(
          "flex flex-col items-start justify-center overflow-hidden min-w-0 transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
          collapsed
            ? "max-w-0 opacity-0 pointer-events-none flex-none"
            : "max-w-[200px] flex-1 opacity-100 delay-75"
        )}
        aria-hidden={collapsed}
      >
        <Link
          href="/settings/account"
          className="flex flex-col items-start justify-center min-w-0 w-full"
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
        {profileIsPublic && username && (
          <Link
            href={`/u/${username}`}
            className="text-[11px] uppercase tracking-widest text-kyar-accent hover:underline mt-0.5"
          >
            View profile
          </Link>
        )}
      </div>
    </div>
  );
}
