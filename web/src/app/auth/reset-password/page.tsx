"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

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
      <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
        <div className="w-full max-w-md text-center">
          <h1 className="font-serif text-3xl italic tracking-tight mb-4">Invalid Link</h1>
          <p className="text-sm text-kyar-textSecondary mb-8">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block border border-black px-8 py-3 text-xs uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="meta-label mb-2 opacity-40">Security</p>
          <h1 className="font-serif text-4xl italic tracking-tight">New Password</h1>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="meta-label block mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
              className="w-full border border-kyar-border px-4 py-3 text-sm focus:outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="meta-label block mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-kyar-border px-4 py-3 text-sm focus:outline-none focus:border-black"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 text-xs uppercase tracking-widest font-semibold hover:bg-kyar-textSecondary transition-colors disabled:opacity-50"
          >
            {loading ? "Saving…" : "Set New Password"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/auth/signin" className="text-xs text-kyar-textTertiary hover:text-black">
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
