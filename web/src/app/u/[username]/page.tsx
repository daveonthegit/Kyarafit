"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { api } from "convex/_generated/api";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { OnlineOnlyBanner } from "@/components/OnlineOnlyBanner";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function PublicProfilePage() {
  const params = useParams();
  const username = typeof params.username === "string" ? params.username : "";
  const { userId: currentUserId } = useCurrentUser();
  const profile = useQuery(api.users.getByUsername, username ? { username } : "skip");
  const currentUser = useQuery(
    api.users.getByExternalId,
    currentUserId ? { externalId: currentUserId } : "skip"
  );
  const builds = useQuery(
    api.builds.listPublicByUser,
    profile?.userId ? { userId: profile.userId } : "skip"
  );
  const isFollowing = useQuery(
    api.follows.isFollowing,
    currentUserId && profile?.userId && currentUserId !== profile.userId
      ? { followerId: currentUserId, followingId: profile.userId }
      : "skip"
  );
  const followMut = useMutation(api.follows.follow);
  const unfollowMut = useMutation(api.follows.unfollow);
  const [followPending, setFollowPending] = useState(false);

  const handleFollow = async () => {
    if (!currentUserId || !profile?.userId || followPending) return;
    setFollowPending(true);
    try {
      if (isFollowing) {
        await unfollowMut({ followerId: currentUserId, followingId: profile.userId });
      } else {
        await followMut({ followerId: currentUserId, followingId: profile.userId });
      }
    } finally {
      setFollowPending(false);
    }
  };

  if (username && profile === null) {
    const isOwnProfile = currentUser?.username?.toLowerCase() === username.toLowerCase().trim();
    return (
      <WebAppShell>
        <div className="pt-16 flex flex-col items-center justify-center px-6 min-h-[50vh] text-center">
          {isOwnProfile ? (
            <>
              <p className="text-kyar-textSecondary">
                Your profile is private or the link doesn’t match your username.
              </p>
              <p className="text-sm text-kyar-textTertiary mt-2">
                Set profile to <strong>Public</strong> and save in Settings → Account to share it.
                Use the exact username shown there in the URL (e.g. /u/yourusername).
              </p>
              <Link
                href="/settings/account"
                className="mt-4 text-sm text-kyar-accent hover:underline"
              >
                Open Settings → Account
              </Link>
            </>
          ) : (
            <>
              <p className="text-kyar-textSecondary">Profile not found or not public.</p>
              <Link href="/home" className="mt-4 text-sm text-kyar-accent hover:underline">
                Go home
              </Link>
            </>
          )}
        </div>
      </WebAppShell>
    );
  }

  if (profile === undefined) {
    return (
      <WebAppShell>
        <OnlineOnlyBanner className="mt-4" />
        <div className="pt-16 flex items-center justify-center min-h-[50vh]">
          <p className="text-kyar-textSecondary">Loading…</p>
        </div>
      </WebAppShell>
    );
  }

  if (!profile) {
    return null;
  }

  const displayName = profile.displayName ?? profile.name ?? profile.username ?? "Cosplayer";

  return (
    <WebAppShell>
      <OnlineOnlyBanner className="mt-4" />
      <header className="pt-16 pb-6">
        <Link
          href="/discover"
          className="text-[11px] uppercase tracking-widest text-kyar-textSecondary hover:text-kyar-accent mb-2 inline-block"
        >
          Discover
        </Link>
      </header>

      <main className="max-w-3xl mx-auto mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border border-kyar-borderSubtle shadow-soft bg-kyar-muted flex-shrink-0">
            {profile.imageStorageId ? (
              <ResolvedImage
                imageStorageId={profile.imageStorageId}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : profile.image ? (
              <img src={profile.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-4xl text-kyar-textTertiary material-symbols-outlined">
                person
              </span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-4xl sm:text-5xl font-normal italic tracking-tight leading-none mb-2">
              {displayName}
            </h1>
            {profile.username && (
              <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                @{profile.username}
              </p>
            )}
            {currentUserId && profile.userId !== currentUserId && (
              <button
                type="button"
                onClick={handleFollow}
                disabled={followPending}
                className="mt-4 px-8 py-3 text-[9px] font-bold uppercase tracking-widest border border-kyar-borderSubtle rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors disabled:opacity-50 shadow-sm"
              >
                {followPending ? "…" : isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
            {profile.bio && (
              <p className="mt-4 text-sm text-kyar-text leading-relaxed max-w-xl">{profile.bio}</p>
            )}
          </div>
        </div>

        <section>
          <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-6 border-b border-kyar-borderSubtle pb-3">
            Public builds
          </h2>
          {builds === undefined ? (
            <p className="text-sm text-kyar-textSecondary">Loading builds…</p>
          ) : builds.length === 0 ? (
            <p className="text-sm text-kyar-textSecondary">No public builds yet.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {builds.map((b) => (
                <li key={b._id}>
                  <PublicBuildCard build={b} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </WebAppShell>
  );
}
