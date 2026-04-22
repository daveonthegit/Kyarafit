"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";

/**
 * Compact footer links — avoids duplicating the sticky header (logo + large CTAs).
 */
export function LandingFooterStrip() {
  const { data: session, isPending } = authClient.useSession();
  const loggedIn = Boolean(session?.user);

  if (isPending) {
    return <span className="h-4 w-24 animate-pulse rounded bg-kyar-borderSubtle" aria-hidden />;
  }

  return (
    <nav
      className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-kyar-textSecondary"
      aria-label="Footer links"
    >
      {loggedIn ? (
        <>
          <Link href="/home" className="underline-offset-4 hover:text-kyar-text hover:underline">
            Go to app
          </Link>
          <Link
            href="/settings"
            className="underline-offset-4 hover:text-kyar-text hover:underline"
          >
            Account
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/auth/signin"
            className="underline-offset-4 hover:text-kyar-text hover:underline"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="underline-offset-4 hover:text-kyar-text hover:underline"
          >
            Get started
          </Link>
        </>
      )}
      <Link href="/privacy" className="underline-offset-4 hover:text-kyar-text hover:underline">
        Privacy Policy
      </Link>
      <Link href="/terms" className="underline-offset-4 hover:text-kyar-text hover:underline">
        Terms of Service
      </Link>
    </nav>
  );
}
