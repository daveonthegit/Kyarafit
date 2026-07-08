"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { AuthGlassFrame } from "@/components/auth/AuthGlassFrame";

export default function VerifyEmailInboxPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) return;
    setError(null);
    setResending(true);
    try {
      const callbackURL =
        typeof window !== "undefined" ? `${window.location.origin}/home` : "/home";
      const { error: authError } = await authClient.sendVerificationEmail({
        email,
        callbackURL,
      });
      if (authError) {
        setError(authError.message ?? "Failed to resend. Try again.");
      } else {
        setResent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthGlassFrame icon="mark_email_unread" eyebrow="One more step" title="Check your inbox">
      <div className="text-center">
        <p className="mb-8 -mt-2 text-sm text-media-fg-70 leading-relaxed">
          We sent a verification link to{" "}
          {email ? <strong className="text-kyar-media-fg">{email}</strong> : "your email address"}.
          Click the link to activate your account.
        </p>

        {error && (
          <div className="mb-4 rounded-[10px] border border-on-glass-danger/40 bg-on-glass-danger/15 p-4 text-sm text-left text-kyar-media-fg">
            {error}
          </div>
        )}

        {resent && (
          <div className="mb-4 rounded-[10px] border border-on-glass-chip-done-fg/30 bg-on-glass-chip-done-bg p-4 text-sm text-left text-on-glass-chip-done-fg">
            Verification email resent. Check your inbox (and spam folder).
          </div>
        )}

        <div className="space-y-3 mt-8">
          {email && !resent && (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] uppercase tracking-[0.16em] font-bold hover:bg-glass-active transition-colors disabled:opacity-50"
            >
              {resending ? "Resending…" : "Resend verification email"}
            </button>
          )}
          <Link
            href="/auth/signin"
            className="block w-full min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] uppercase tracking-[0.16em] font-bold hover:bg-glass-active transition-colors text-center"
          >
            Back to sign in
          </Link>
        </div>

        <p className="mt-8 text-xs text-media-fg-55">
          Didn&apos;t receive anything? Check your spam folder or{" "}
          <Link href="/auth/signup" className="underline hover:text-kyar-media-fg">
            try a different email
          </Link>
          .
        </p>
      </div>
    </AuthGlassFrame>
  );
}
