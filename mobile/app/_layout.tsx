import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initClosetDb } from '../src/storage/db';
import { getOrCreateDeviceId } from '../src/lib/deviceId';
import { setDeviceId, runSync } from '../src/services/sync';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    let mounted = true;
    (async () => {
      await initClosetDb();
      const deviceId = await getOrCreateDeviceId();
      setDeviceId(deviceId);
      if (mounted) await runSync();
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync();
    });
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
