"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleEmailBlur = () => {
    setEmailError(null);
    if (email && !validateEmail(email)) {
      setEmailError("Please enter a valid email address");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);

    // Validate email format before submission
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    const { error } = await signUp.email({ email, password });

    if (error) {
      // Check for common error messages indicating email already exists
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes("already") ||
        errorMessage.includes("exists") ||
        errorMessage.includes("registered") ||
        errorMessage.includes("duplicate")
      ) {
        setEmailError("This email is already registered. Try signing in instead.");
        setError(null);
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Supabase sends confirmation email by default
      // After confirmation, user can sign in
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <span className="text-6xl">✓</span>
          </div>
          <h1 className="font-serif text-3xl italic mb-4">Check your email</h1>
          <p className="text-kyar-textSecondary mb-8">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-kyar-textSecondary mb-8">
            Click the link in the email to verify your account, then you can sign in.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block border border-black px-6 py-3 text-xs uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <p className="meta-label mb-2 opacity-40">Join Kyarafit</p>
          <h1 className="font-serif text-4xl italic tracking-tight">Create account</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">{error}</div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-[11px] uppercase tracking-widest font-medium mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              onBlur={handleEmailBlur}
              required
              className={`w-full border-0 border-b bg-transparent py-2 focus:outline-none transition-colors ${
                emailError
                  ? "border-red-500 focus:border-red-500"
                  : "border-kyar-border focus:border-black"
              }`}
              placeholder="you@example.com"
            />
            {emailError && (
              <p className="text-xs text-red-600 mt-1">
                {emailError}
                {emailError.includes("already registered") && (
                  <>
                    {" "}
                    <Link href="/auth/signin" className="underline font-semibold">
                      Sign in here
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] uppercase tracking-widest font-medium mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border-0 border-b border-kyar-border bg-transparent py-2 focus:outline-none focus:border-black transition-colors"
              placeholder="••••••••"
            />
            <p className="text-xs text-kyar-textTertiary mt-1">At least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-black py-3 text-xs uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-kyar-textSecondary">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-black underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-kyar-textTertiary hover:text-black">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
