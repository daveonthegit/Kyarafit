"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "convex/_generated/api";

const PUBLIC_PATHS = [
  "/",
  "/privacy",
  "/terms",
  "/auth/signin",
  "/auth/signup",
  "/auth/verify-email",
  "/auth/reset-password",
  "/u",
  "/b",
  "/discover",
  "/feed",
];

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * `users.upsert` derives the acting user from the Convex session, so it rejects the
 * call until the Convex auth token has propagated from the Better Auth session.
 * That window is short but real, and it lands on first sign-up, where failing would
 * leave the account without its `users` row. Retry a few times with backoff.
 */
const MIRROR_RETRY_DELAYS_MS = [250, 750, 2000, 5000];

function ProtectedAuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const upsertUser = useMutation(api.users.upsert);
  const recalculateUsage = useMutation(api.users.recalculateUsage);
  const lastSyncedId = useRef<string | null>(null);
  const nextAttempt = useRef(0);

  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? undefined;
  const image = session?.user?.image ?? undefined;
  const authUser = session?.user as { username?: string; displayUsername?: string } | undefined;
  const rawUsername = authUser?.username ?? authUser?.displayUsername ?? undefined;
  const username = rawUsername?.trim() ? rawUsername.trim().toLowerCase() : undefined;

  useEffect(() => {
    if (!userId) {
      lastSyncedId.current = null;
      nextAttempt.current = 0;
      return;
    }
    if (userId === lastSyncedId.current) return;
    lastSyncedId.current = userId;
    const args = { externalId: userId, email, name, image, username };

    let cancelled = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const mirror = (attempt: number) => {
      nextAttempt.current = attempt;
      upsertUser(args)
        .then(() => recalculateUsage())
        .then(() => {
          settled = true;
          nextAttempt.current = 0;
        })
        .catch(() => {
          if (cancelled) return;
          const delay = MIRROR_RETRY_DELAYS_MS[attempt];
          if (delay === undefined) {
            // Out of retries: clear the guard so a later session change tries again.
            settled = true;
            lastSyncedId.current = null;
            return;
          }
          timer = setTimeout(() => mirror(attempt + 1), delay);
        });
    };
    // Resume where a torn-down chain left off, so the retries stay bounded overall.
    mirror(nextAttempt.current);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      // A re-run of this effect (a new session object for the same user, or
      // StrictMode's double invoke) must not leave an unfinished chain cancelled and
      // the guard still set, which would skip the retry the new-signup token-lag
      // window needs.
      if (!settled) lastSyncedId.current = null;
    };
  }, [userId, email, name, image, username, upsertUser, recalculateUsage]);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/auth/signin");
    }
  }, [session, isPending, pathname, router]);

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  return <ProtectedAuthGate>{children}</ProtectedAuthGate>;
}
