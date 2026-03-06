"use client";

import { useState } from "react";
import Link from "next/link";

export type UserWithUsername = {
  username?: string;
  displayUsername?: string;
  name?: string;
  email?: string | null;
  image?: string | null;
};

type Props = {
  user: UserWithUsername;
  onUpdateUsername: (username: string) => Promise<{ error: { message?: string } | null }>;
};

export function AccountDetailsContent({ user, onUpdateUsername }: Props) {
  const usernameDisplay = user.displayUsername ?? user.username ?? null;
  const [newUsername, setNewUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleCreateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }
    setUsernameError(null);
    setUsernameLoading(true);
    try {
      const { error } = await onUpdateUsername(trimmed);
      if (error) {
        setUsernameError(error.message ?? "Could not set username. Try another.");
      } else {
        setNewUsername("");
      }
    } catch {
      setUsernameError("Something went wrong. Please try again.");
    } finally {
      setUsernameLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">Email</p>
        <p className="text-sm" data-testid="account-email">
          {user.email ?? "—"}
        </p>
      </div>
      <div className="py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
          Display name
        </p>
        <p className="text-sm" data-testid="account-name">
          {user.name ?? "—"}
        </p>
      </div>
      <div className="py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
          Username
        </p>
        {usernameDisplay ? (
          <p className="text-sm" data-testid="account-username">
            {usernameDisplay}
          </p>
        ) : (
          <form onSubmit={handleCreateUsername} className="mt-2 space-y-2">
            <label htmlFor="new-username" className="sr-only">
              Create a username
            </label>
            <input
              id="new-username"
              type="text"
              value={newUsername}
              onChange={(e) => {
                setNewUsername(e.target.value);
                setUsernameError(null);
              }}
              placeholder="Choose a username (3+ characters)"
              minLength={3}
              maxLength={30}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-kyar-accent/50"
              disabled={usernameLoading}
              data-testid="account-username-input"
              autoComplete="username"
            />
            {usernameError && (
              <p className="text-xs text-red-500" role="alert">
                {usernameError}
              </p>
            )}
            <button
              type="submit"
              disabled={usernameLoading || newUsername.trim().length < 3}
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {usernameLoading ? "Saving…" : "Create username"}
            </button>
          </form>
        )}
      </div>
      <div className="pt-4">
        <Link
          href="/auth/reset-password"
          className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
        >
          Change password
        </Link>
        <p className="mt-1 text-[11px] text-kyar-textSecondary">
          We’ll send you a link to set a new password.
        </p>
      </div>
    </section>
  );
}
