"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { AuthGlassFrame } from "@/components/auth/AuthGlassFrame";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!token) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (authError) {
        setError(authError.message ?? "Failed to reset password. The link may have expired.");
      } else {
        router.push("/auth/signin?reset=success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthGlassFrame eyebrow="Security" title="Invalid link">
        <div className="text-center">
          <p className="mb-8 -mt-2 text-sm text-media-fg-70">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block min-h-[44px] rounded-full border border-glass-border-strong bg-glass-bar px-8 py-3 text-[10px] uppercase tracking-[0.16em] font-bold hover:bg-glass-active transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </AuthGlassFrame>
    );
  }

  return (
    <AuthGlassFrame eyebrow="Security" title="New password">
      <div>
        {error && (
          <div className="mb-4 rounded-[10px] border border-on-glass-danger/40 bg-on-glass-danger/15 p-4 text-sm text-kyar-media-fg">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
              className="glass-field w-full px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="glass-field w-full px-4 py-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] rounded-full bg-glass-solid text-glass-ink py-3 text-[10px] uppercase tracking-[0.16em] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Saving…" : "Set New Password"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/auth/signin" className="text-xs text-media-fg-55 hover:text-kyar-media-fg">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </AuthGlassFrame>
  );
}
