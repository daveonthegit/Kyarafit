"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { authClient } from "@/lib/auth/auth-client";
import { api } from "convex/_generated/api";

const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/auth/verify-email",
  "/auth/reset-password",
  "/u",
  "/b",
  "/discover",
  "/feed",
];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const upsertUser = useMutation(api.users.upsert);
  const recalculateUsage = useMutation(api.users.recalculateUsage);
  const lastSyncedId = useRef<string | null>(null);

  // Ensure Convex app user row exists when signed in (needed for storage tracking and getMe).
  // After upsert, recalc storage so uploads from before the user row existed are counted.
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
    upsertUser({
      externalId: id,
      email: session.user.email ?? "",
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
      username: username?.trim() ? username.trim().toLowerCase() : undefined,
    })
      .then(() => recalculateUsage())
      .catch(() => {
        lastSyncedId.current = null;
      });
  }, [session?.user, upsertUser, recalculateUsage]);

  useEffect(() => {
    if (isPending) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isPublic && !session) {
      router.replace("/auth/signin");
    }
  }, [session, isPending, pathname, router]);

  return <>{children}</>;
}
