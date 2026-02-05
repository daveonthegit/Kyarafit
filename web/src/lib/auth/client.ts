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
  return currentToken;
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
