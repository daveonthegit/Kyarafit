"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

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
    <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="text-5xl mb-6">📬</div>
          <h1 className="font-serif text-3xl italic tracking-tight mb-3">Check your inbox</h1>
          <p className="text-sm text-kyar-textSecondary leading-relaxed">
            We sent a verification link to{" "}
            {email ? <strong className="text-kyar-text">{email}</strong> : "your email address"}.
            Click the link to activate your account.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 text-sm text-left">
            {error}
          </div>
        )}

        {resent && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 text-sm text-left">
            Verification email resent. Check your inbox (and spam folder).
          </div>
        )}

        <div className="space-y-3 mt-8">
          {email && !resent && (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full border border-kyar-border py-3 text-xs uppercase tracking-widest font-semibold hover:border-kyar-text transition-colors disabled:opacity-50"
            >
              {resending ? "Resending…" : "Resend verification email"}
            </button>
          )}
          <Link
            href="/auth/signin"
            className="block w-full border border-kyar-border py-3 text-xs uppercase tracking-widest font-semibold hover:border-kyar-text transition-colors text-center"
          >
            Back to sign in
          </Link>
        </div>

        <p className="mt-8 text-xs text-kyar-textTertiary">
          Didn&apos;t receive anything? Check your spam folder or{" "}
          <Link href="/auth/signup" className="underline hover:text-kyar-text">
            try a different email
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
