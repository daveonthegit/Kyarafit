'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth/client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn.email({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/home');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-kyar-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <p className="meta-label mb-2 opacity-40">Welcome back</p>
          <h1 className="font-serif text-4xl italic tracking-tight">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-[11px] uppercase tracking-widest font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border-0 border-b border-kyar-border bg-transparent py-2 focus:outline-none focus:border-black transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[11px] uppercase tracking-widest font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border-0 border-b border-kyar-border bg-transparent py-2 focus:outline-none focus:border-black transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-black py-3 text-xs uppercase tracking-widest font-semibold hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-kyar-textSecondary">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-black underline">
              Sign up
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
