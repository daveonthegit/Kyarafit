import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession, getTokenForSync } from '../src/lib/auth/client';
import { getOrCreateDeviceId } from '../src/lib/deviceId';
import { initClosetDb } from '../src/storage/db';
import { setDeviceId, runSync } from '../src/services/sync';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const { session, loading } = useSession();
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize app
  useEffect(() => {
    let mounted = true;
    (async () => {
      await initClosetDb();
      const deviceId = await getOrCreateDeviceId();
      setDeviceId(deviceId);
      if (mounted) {
        const token = await getTokenForSync();
        await runSync(token);
        setIsInitialized(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Sync on app state change
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getTokenForSync().then((token) => runSync(token));
      }
    });
    return () => sub.remove();
  }, []);

  // Optional routing: if logged in and on auth screen, redirect to tabs
  useEffect(() => {
    if (!isInitialized || loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (session && inAuthGroup) {
      // If logged in and on auth screen, go to tabs
      router.replace('/(tabs)');
    }
  }, [session, segments, loading, isInitialized]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <RootLayoutNav />
    </QueryClientProvider>
  );
}
