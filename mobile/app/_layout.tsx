import "../global.css";
import { useEffect, useState, type ReactNode } from "react";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Sentry from "@sentry/react-native";
import { authClient, hydrateBearerFromSecureStore, setStoredBearerToken } from "@/lib/auth/client";
import { initI18n } from "@/i18n";
import {
  EXPO_PUBLIC_CONVEX_SITE_URL,
  EXPO_PUBLIC_CONVEX_URL,
  EXPO_PUBLIC_SENTRY_DSN,
} from "@/config/env";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { useAppFonts } from "@/theme/appFonts";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { SyncWorkerProvider } from "@/offline";
import { RevenueCatBootstrap } from "@/components/RevenueCatBootstrap";

WebBrowser.maybeCompleteAuthSession();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

function ThemeChrome({ children }: { children: ReactNode }) {
  const { resolvedScheme } = useTheme();
  return (
    <>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1 }}>{children}</View>
    </>
  );
}

const convex = new ConvexReactClient(EXPO_PUBLIC_CONVEX_URL || "https://placeholder.convex.cloud");

if (EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
  });
}

function RootLayoutNav() {
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hydrateBearerFromSecureStore();
        await initI18n();
      } finally {
        if (!cancelled) {
          setBootReady(true);
          await SplashScreen.hideAsync();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const incomingUrl = Linking.useURL();
  useEffect(() => {
    if (!incomingUrl || !EXPO_PUBLIC_CONVEX_SITE_URL) return;
    const parsed = Linking.parse(incomingUrl);
    const ott = parsed.queryParams?.ott;
    if (!ott || typeof ott !== "string") return;

    (async () => {
      try {
        const res = await fetch(
          `${EXPO_PUBLIC_CONVEX_SITE_URL.replace(/\/$/, "")}/auth/cross-domain/one-time-token/verify`,
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
        await setStoredBearerToken(sessionToken);
        await authClient.getSession({
          fetchOptions: { headers: { Authorization: `Bearer ${sessionToken}` } },
        });
        const signal = (
          authClient as { $sessionSignal?: { get: () => boolean; set: (v: boolean) => void } }
        ).$sessionSignal;
        if (signal) {
          const val = signal.get();
          signal.set(!val);
        }
        router.replace("/(app)/(tabs)");
      } catch (err) {
        console.error("[auth] OTT exchange failed:", err);
      }
    })();
  }, [incomingUrl]);

  if (!bootReady) {
    return null;
  }

  return (
    <View className="flex-1">
      <ConnectivityBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return null;
  }

  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeChrome>
        <RootLayoutNav />
      </ThemeChrome>
    </QueryClientProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
              <RevenueCatBootstrap />
              <SyncWorkerProvider>
                <BottomSheetModalProvider>{content}</BottomSheetModalProvider>
              </SyncWorkerProvider>
            </ConvexBetterAuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
