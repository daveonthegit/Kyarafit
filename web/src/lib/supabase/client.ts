"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  // Warn in development if Supabase is not properly configured
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl.includes("placeholder")) {
      console.warn(
        "⚠️ NEXT_PUBLIC_SUPABASE_URL is not set or using placeholder. " +
          "Authentication will not work. Set this in web/.env.local"
      );
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseKey.includes("placeholder")) {
      console.warn(
        "⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set or using placeholder. " +
          "Authentication will not work. Set this in web/.env.local"
      );
    }
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
