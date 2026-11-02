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
      <WebAppShell fullBleed>
        <div className="relative flex flex-1 flex-col items-center justify-center bg-studio-wall px-4 py-16 text-center text-kyar-media-fg">
          <div className="w-full max-w-md rounded-glass border border-glass-border bg-glass p-8 backdrop-blur-glass">
            {isOwnProfile ? (
              <>
                <p className="font-serif text-2xl italic leading-snug">
                  Your profile is private or the link doesn’t match your username.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-media-fg-70">
                  Set profile to <strong>Public</strong> and save in Settings → Account to share it.
                  Use the exact username shown there in the URL (e.g. /u/yourusername).
                </p>
                <Link
                  href="/settings/account"
                  className="mt-5 inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg underline decoration-glass-border-strong underline-offset-4 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Open Settings → Account
                </Link>
              </>
            ) : (
              <>
                <p className="font-serif text-2xl italic leading-snug">
                  Profile not found or not public.
                </p>
                <Link
                  href="/home"
                  className="mt-5 inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg underline decoration-glass-border-strong underline-offset-4 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Go home
                </Link>
              </>
            )}
          </div>
        </div>
      </WebAppShell>
    );
  }

  if (profile === undefined) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex flex-1 flex-col bg-studio-wall px-4 text-kyar-media-fg sm:px-6 lg:px-10">
          <OnlineOnlyBanner surface="glass" className="mx-auto mt-6 w-full max-w-3xl" />
          <div className="flex min-h-[50vh] items-center justify-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
              Loading…
            </p>
          </div>
        </div>
      </WebAppShell>
    );
  }

  if (!profile) {
    return null;
  }

  const displayName = profile.displayName ?? profile.name ?? profile.username ?? "Cosplayer";

  return (
    <WebAppShell fullBleed>
      <div className="relative flex flex-1 flex-col bg-studio-wall px-4 pb-16 text-kyar-media-fg sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <OnlineOnlyBanner surface="glass" className="mt-6" />
          <header className="pt-6 pb-4">
            <Link
              href="/discover"
              className="-ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              <span aria-hidden>◂</span> Discover
            </Link>
          </header>

          <main>
            <div className="mb-10 flex flex-col items-start gap-6 rounded-glass border border-glass-border bg-glass p-6 backdrop-blur-glass sm:flex-row sm:items-center sm:p-8">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border border-glass-border-strong bg-glass-active sm:h-32 sm:w-32">
                {profile.imageStorageId ? (
                  <ResolvedImage
                    imageStorageId={profile.imageStorageId}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : profile.image ? (
                  <img src={profile.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-4xl font-extralight text-media-fg-45">
                    person
                  </span>
                )}
              </div>
              <div className="flex-1">
                <h1 className="mb-2 font-serif text-[40px] font-normal italic leading-none tracking-tight sm:text-5xl">
                  {displayName}
                </h1>
                {profile.username && (
                  <p className="text-[10px] uppercase tracking-[0.2em] text-media-fg-55">
                    @{profile.username}
                  </p>
                )}
                {currentUserId && profile.userId !== currentUserId && (
                  <button
                    type="button"
                    onClick={handleFollow}
                    disabled={followPending}
                    className={`mt-4 min-h-[44px] rounded-full px-8 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 ${
                      isFollowing
                        ? "border border-glass-border-strong bg-glass-bar text-kyar-media-fg hover:bg-glass-active"
                        : "bg-glass-solid text-glass-ink hover:opacity-90"
                    }`}
                  >
                    {followPending ? "…" : isFollowing ? "Unfollow" : "Follow"}
                  </button>
                )}
                {profile.bio && (
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-media-fg-70">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            <section>
              <h2 className="mb-5 border-b border-glass-divider-strong pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
                Public builds
              </h2>
              {builds === undefined ? (
                <p className="text-sm text-media-fg-55">Loading builds…</p>
              ) : builds.length === 0 ? (
                <p className="text-sm text-media-fg-55">No public builds yet.</p>
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
        </div>
      </div>
    </WebAppShell>
  );
}
