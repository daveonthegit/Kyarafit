"use client";

import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth/auth-client";

type Variant = "header" | "hero" | "footer" | "cta";

const linkBase =
  "inline-flex min-h-[40px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg border-b border-kyar-media-fg pb-0.5 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-kyar-accent rounded-sm";
const buttonPrimary =
  "inline-flex min-h-[52px] items-center justify-center rounded-full bg-glass-solid px-6 py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-kyar-accent transition-opacity";
const buttonSecondary =
  "inline-flex min-h-[52px] items-center justify-center rounded-full border border-glass-border-strong bg-glass-bar px-6 py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg hover:bg-glass-active focus:outline-none focus:ring-2 focus:ring-kyar-accent transition-colors";
const footerLink =
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg focus:outline-none focus:ring-2 focus:ring-kyar-accent rounded-sm";
const footerButton =
  "text-[10px] font-bold uppercase tracking-[0.16em] border border-glass-border-strong bg-glass-bar text-kyar-media-fg px-4 py-2 rounded-full hover:bg-glass-active transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent";

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
                  className="rounded-full border border-glass-border-strong"
                />
              ) : (
                <span className="material-symbols-outlined text-2xl text-media-fg-70">
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
