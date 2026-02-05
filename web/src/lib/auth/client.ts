"use client";

import { useEffect, useState } from "react";
import { createClient } from "../supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const supabase = createClient();

// Store token for synchronous access by API clients
let currentToken: string | null = null;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      currentToken = session?.access_token ?? null;
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      currentToken = session?.access_token ?? null;
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/** Token for backend API (Bearer). Used by API clients. */
export function getToken(): string | null {
  if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
    // Log token presence for debugging (not the actual token value)
    if (currentToken) {
      console.debug("🔑 Auth token is available");
    } else {
      console.debug("⚠️ Auth token is NOT available - user may not be signed in");
    }
  }
  return currentToken;
}

/**
 * Decode JWT payload for debugging purposes.
 * WARNING: This does NOT validate the signature - only for debugging!
 */
export function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
}

/**
 * Get debug info about the current auth state (for development).
 */
export function getAuthDebugInfo(): {
  hasToken: boolean;
  tokenPayload: Record<string, any> | null;
  tokenExpiry: Date | null;
} {
  const hasToken = currentToken !== null;
  let tokenPayload = null;
  let tokenExpiry = null;

  if (currentToken) {
    tokenPayload = decodeTokenPayload(currentToken);
    if (tokenPayload && tokenPayload.exp) {
      tokenExpiry = new Date(tokenPayload.exp * 1000);
    }
  }

  return { hasToken, tokenPayload, tokenExpiry };
}

export const signIn = {
  email: async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  },
};

export const signUp = {
  email: async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  },
};

export async function signOut() {
  await supabase.auth.signOut();
  currentToken = null;
}
