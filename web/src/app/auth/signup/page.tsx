"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { AuthGlassFrame } from "@/components/auth/AuthGlassFrame";

const socialButtonClass =
  "w-full min-h-[44px] flex items-center justify-center gap-3 rounded-full border border-glass-border-strong bg-glass-bar py-3 text-[10px] uppercase tracking-[0.16em] font-bold hover:bg-glass-active transition-colors disabled:opacity-50";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setOauthLoading(provider);
    try {
      await authClient.signIn.social({ provider, callbackURL: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setOauthLoading(null);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
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
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);
    try {
      // Full URL so after verification Convex redirects to the app, not to Convex /home
      const callbackURL =
        typeof window !== "undefined" ? `${window.location.origin}/home` : "/home";
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email,
        password,
        username: username.trim(),
        callbackURL,
      });
      if (authError) {
        setError(authError.message ?? "Sign up failed. Please try again.");
      } else {
        router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const anyLoading = loading || oauthLoading !== null;

  return (
    <AuthGlassFrame eyebrow="Join">
      <div>
        {error && (
          <div className="mb-4 rounded-[10px] border border-on-glass-danger/40 bg-on-glass-danger/15 p-4 text-sm text-kyar-media-fg">
            {error}
          </div>
        )}

        {/* OAuth */}
        <div className="space-y-3 mb-6">
          <button
            onClick={() => handleOAuth("google")}
            disabled={anyLoading}
            className={socialButtonClass}
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
            {oauthLoading === "google" ? "Redirecting…" : "Sign up with Google"}
          </button>

          <button
            onClick={() => handleOAuth("apple")}
            disabled={anyLoading}
            className={socialButtonClass}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            {oauthLoading === "apple" ? "Redirecting…" : "Sign up with Apple"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 border-t border-glass-border" />
          <span className="text-[10px] text-media-fg-55 uppercase tracking-[0.16em]">or</span>
          <div className="flex-1 border-t border-glass-border" />
        </div>

        {/* Sign-up form */}
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="glass-field w-full px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (3+ characters)"
              className="glass-field w-full px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="glass-field w-full px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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
            disabled={anyLoading}
            className="w-full min-h-[44px] rounded-full bg-glass-solid text-glass-ink py-3 text-[10px] uppercase tracking-[0.16em] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-media-fg-55">
          Already have an account?{" "}
          <Link href="/auth/signin" className="underline hover:text-kyar-media-fg">
            Sign in
          </Link>
        </p>

        <div className="mt-6 text-center">
          <p className="text-xs text-media-fg-55">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-kyar-media-fg">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-kyar-media-fg">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-media-fg-55 hover:text-kyar-media-fg">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </AuthGlassFrame>
  );
}
