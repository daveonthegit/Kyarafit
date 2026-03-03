"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { setStoredBearerToken } from "@/lib/auth/bearer-storage-plugin";

type Mode = "signin" | "forgot";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const [mode, setMode] = useState<Mode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    try {
      await authClient.signIn.social({ provider, callbackURL: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setOauthLoading(null);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowResendVerification(false);
    setLoading(true);
    try {
      // Omit callbackURL so we sync session with the returned token and then navigate.
      // This avoids the redirect plugin and ensures the client has the session (cross-origin cookies may not be sent).
      const { data, error: authError } = await authClient.signIn.email({
        email,
        password,
      });
      if (authError) {
        const msg = authError.message ?? "";
        const isUnverified =
          /verif/i.test(msg) || msg.toLowerCase().includes("email not verified");
        setShowResendVerification(!!isUnverified);
        setError(msg || "Sign in failed. Check your credentials.");
      } else {
        // Persist token so every auth request (get-session, etc.) sends it (cross-origin cookies don't work)
        if (data?.token) {
          setStoredBearerToken(data.token);
          await authClient.getSession({
            fetchOptions: {
              headers: { Authorization: `Bearer ${data.token}` },
            },
          });
        }
        router.push("/home");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      const isUnverified =
        /verif/i.test(msg) || String(msg).toLowerCase().includes("email not verified");
      setShowResendVerification(!!isUnverified);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setInfo(null);
    setResendLoading(true);
    try {
      const callbackURL = typeof window !== "undefined" ? `${window.location.origin}/home` : "/home";
      const { error: authError } = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL,
      });
      if (authError) {
        setError(authError.message ?? "Failed to resend verification email.");
      } else {
        setInfo("Verification email sent. Check your inbox (and spam folder).");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend verification email");
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (authError) {
        setError(authError.message ?? "Failed to send reset email.");
      } else {
        setInfo("Check your inbox — we sent you a password reset link.");
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const anyLoading = loading || oauthLoading !== null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="meta-label mb-2 opacity-40">Welcome to</p>
          <h1 className="font-serif text-4xl italic tracking-tight">Kyarafit</h1>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}
        {(info || resetSuccess) && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
            {resetSuccess ? "Password updated successfully. Sign in below." : info}
          </div>
        )}

        {mode === "forgot" ? (
          /* ── Forgot password ── */
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="meta-label block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-kyar-border px-4 py-3 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <button
              type="submit"
              disabled={anyLoading}
              className="w-full bg-black text-white py-3 text-xs uppercase tracking-widest font-semibold hover:bg-kyar-textSecondary transition-colors disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className="w-full text-xs text-kyar-textTertiary hover:text-black underline"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          /* ── Sign in ── */
          <>
            {/* OAuth */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleOAuth("google")}
                disabled={anyLoading}
                className="w-full flex items-center justify-center gap-3 border border-black py-3 text-xs uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
              </button>

              <button
                onClick={() => handleOAuth("github")}
                disabled={anyLoading}
                className="w-full flex items-center justify-center gap-3 border border-kyar-border py-3 text-xs uppercase tracking-widest font-semibold hover:bg-kyar-border/20 transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {oauthLoading === "github" ? "Redirecting…" : "Continue with GitHub"}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 border-t border-kyar-border" />
              <span className="text-xs text-kyar-textTertiary uppercase tracking-widest">or</span>
              <div className="flex-1 border-t border-kyar-border" />
            </div>

            {/* Email + password */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="meta-label block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-kyar-border px-4 py-3 text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="meta-label">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                    className="text-xs text-kyar-textTertiary hover:text-black underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-kyar-border px-4 py-3 text-sm focus:outline-none focus:border-black"
                />
              </div>
              <button
                type="submit"
                disabled={anyLoading}
                className="w-full bg-black text-white py-3 text-xs uppercase tracking-widest font-semibold hover:bg-kyar-textSecondary transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
              {showResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={anyLoading || resendLoading || !email.trim()}
                  className="w-full border border-kyar-border py-3 text-xs uppercase tracking-widest font-semibold hover:border-black transition-colors disabled:opacity-50 text-kyar-textSecondary hover:text-black"
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              )}
            </form>

            <p className="mt-6 text-center text-xs text-kyar-textTertiary">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="underline hover:text-black">
                Create one
              </Link>
            </p>
          </>
        )}

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-kyar-textTertiary hover:text-black">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
