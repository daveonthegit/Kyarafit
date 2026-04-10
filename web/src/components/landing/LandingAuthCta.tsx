"use client";

import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth/auth-client";

type Variant = "header" | "hero" | "footer" | "cta";

const linkBase =
  "font-sans-wide inline-flex min-h-[40px] items-center text-[10px] sm:text-xs text-kyar-text border-b border-kyar-text pb-0.5 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 focus:ring-offset-kyar-bg rounded-sm";
const buttonPrimary =
  "inline-flex min-h-[52px] items-center justify-center font-sans-wide font-semibold uppercase text-xs tracking-wider rounded-sm bg-kyar-text px-6 py-3 text-center text-kyar-bg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 focus:ring-offset-kyar-bg transition-opacity";
const buttonSecondary =
  "inline-flex min-h-[52px] items-center justify-center font-sans-wide font-semibold uppercase text-xs tracking-wider rounded-sm border border-kyar-text px-6 py-3 text-center text-kyar-text hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 focus:ring-offset-kyar-bg transition-opacity";
const footerLink =
  "font-sans-wide text-[10px] uppercase tracking-wider text-kyar-textSecondary hover:text-kyar-text focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 rounded-sm";
const footerButton =
  "font-sans-wide text-[10px] uppercase tracking-wider border border-kyar-text px-4 py-2 rounded-sm hover:bg-kyar-text hover:text-kyar-bg transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 focus:ring-offset-kyar-bg";

export function LandingAuthCta({ variant }: { variant: Variant }) {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user ?? null;
  const isLoggedIn = Boolean(user);

  if (variant === "header") {
    return (
      <>
        {!isPending && user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/home" className={linkBase}>
              Go to app
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 min-h-[32px] rounded-sm hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2"
              aria-label="Account settings"
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full border border-kyar-borderSubtle"
                />
              ) : (
                <span className="material-symbols-outlined text-2xl text-kyar-textTertiary">
                  account_circle
                </span>
              )}
            </Link>
          </div>
        ) : (
          <Link href="/auth/signin" className={linkBase}>
            Log in
          </Link>
        )}
      </>
    );
  }

  if (variant === "hero") {
    return (
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
        {!isPending && isLoggedIn ? (
          <>
            <Link href="/home" className={`${buttonPrimary} w-full sm:w-auto`}>
              Go to app
            </Link>
            <Link href="/settings" className={`${buttonSecondary} w-full sm:w-auto`}>
              Account
            </Link>
          </>
        ) : (
          <>
            <Link href="/auth/signup" className={`${buttonPrimary} w-full sm:w-auto`}>
              Get started
            </Link>
            <Link href="/auth/signin" className={`${buttonSecondary} w-full sm:w-auto`}>
              Log in
            </Link>
          </>
        )}
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <nav className="flex items-center gap-6" aria-label="Footer navigation">
        {!isPending && isLoggedIn ? (
          <>
            <Link href="/home" className={footerLink}>
              Go to app
            </Link>
            <Link href="/settings" className={footerButton}>
              Account
            </Link>
          </>
        ) : (
          <>
            <Link href="/auth/signin" className={footerLink}>
              Log in
            </Link>
            <Link href="/auth/signup" className={footerButton}>
              Get started
            </Link>
          </>
        )}
      </nav>
    );
  }

  if (variant === "cta") {
    return (
      <>
        {!isPending && isLoggedIn ? (
          <Link href="/home" className={buttonPrimary}>
            Go to app
          </Link>
        ) : (
          <Link href="/auth/signup" className={buttonPrimary}>
            Get started on web
          </Link>
        )}
      </>
    );
  }

  return null;
}
