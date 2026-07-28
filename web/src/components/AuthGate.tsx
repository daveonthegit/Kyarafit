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

  useEffect(() => {
    if (!session?.user) {
      lastSyncedId.current = null;
      return;
    }
    const id = session.user.id;
    if (id === lastSyncedId.current) return;
    lastSyncedId.current = id;
    const authUser = session.user as { username?: string; displayUsername?: string };
    const username = authUser.username ?? authUser.displayUsername ?? undefined;
    const args = {
      externalId: id,
      email: session.user.email ?? "",
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
      username: username?.trim() ? username.trim().toLowerCase() : undefined,
    };

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const mirror = (attempt: number) => {
      upsertUser(args)
        .then(() => recalculateUsage())
        .catch(() => {
          if (cancelled) return;
          const delay = MIRROR_RETRY_DELAYS_MS[attempt];
          if (delay === undefined) {
            // Out of retries: clear the guard so a later session change tries again.
            lastSyncedId.current = null;
            return;
          }
          timer = setTimeout(() => mirror(attempt + 1), delay);
        });
    };
    mirror(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [session?.user, upsertUser, recalculateUsage]);

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
