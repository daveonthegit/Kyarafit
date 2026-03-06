import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import * as Linking from "expo-linking";
import { useSession, authClient, setStoredBearerToken } from "../src/lib/auth/client";
import { getOrCreateDeviceId } from "../src/lib/deviceId";
import { initClosetDb } from "../src/storage/db";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { useConvexSync } from "../src/hooks/useConvexSync";

const queryClient = new QueryClient();

// Always create a client so ConvexProvider is present; tabs use useQuery(api.*) and useCurrentUser().
// Without a provider, useQuery throws. Use placeholder URL when env is missing (e.g. mobile web).
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";
const convex = new ConvexReactClient(convexUrl || "https://placeholder.convex.cloud");

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const { session, loading } = useSession();
  const { userId } = useCurrentUser();
  const [isInitialized, setIsInitialized] = useState(false);

  // Keep SQLite ↔ Convex in sync for signed-in users
  useConvexSync(userId ?? null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await initClosetDb();
      await getOrCreateDeviceId();
      if (mounted) {
        setIsInitialized(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || loading) return;

    const inAuthGroup = segments[0] === "auth";

    if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, segments, loading, isInitialized]);

  // Handle OAuth deep-link callback: kyarafit:///?ott=<one-time-token>
  // The crossDomain server plugin appends ?ott= to the callbackURL after OAuth completes.
  // We exchange the OTT for a session token, persist it, and trigger a session refresh.
  // Note: callbackURL must be kyarafit:/// (not kyarafit://(tabs)) — parentheses are
  // invalid hostname characters and cause Better Auth to reject the request with 403.
  const incomingUrl = Linking.useURL();
  useEffect(() => {
    if (!incomingUrl || !CONVEX_SITE_URL) return;
    const parsed = Linking.parse(incomingUrl);
    const ott = parsed.queryParams?.ott;
    if (!ott || typeof ott !== "string") return;

    (async () => {
      try {
        const res = await fetch(
          `${CONVEX_SITE_URL.replace(/\/$/, "")}/auth/cross-domain/one-time-token/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: ott }),
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        const sessionToken: string | undefined = data?.session?.token;
        if (!sessionToken) return;
        // setStoredBearerToken sets the in-memory cache synchronously, so any
        // subsequent auth fetch (including the session-signal refresh below) will
        // include the bearer token without waiting for AsyncStorage to finish writing.
        await setStoredBearerToken(sessionToken);
        // Trigger the reactive session refresh. The memory token is already set,
        // so GET /auth/get-session will include the bearer token and update useSession().
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const signal = (authClient as any).$sessionSignal;
        if (signal) {
          const val = signal.get();
          signal.set(!val);
        }
      } catch (err) {
        console.error("[auth] OTT exchange failed:", err);
      }
    })();
  }, [incomingUrl]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="packing" />
    </Stack>
  );
}

export default function RootLayout() {
  const content = (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </QueryClientProvider>
  );

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      {content}
    </ConvexBetterAuthProvider>
  );
}
