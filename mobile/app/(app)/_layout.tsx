import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useAppSession } from "@/lib/auth/appSession";
import { VaultErrorScreen } from "@/components/vault/VaultErrorScreen";
import { APP_HREF } from "@/lib/appRoutes";
import { glassHeaderOptions } from "@/theme/glassNavigation";

export default function AppGroupLayout() {
  // Gate on the local vault, not on a live server session: once an account has signed in here the
  // studio opens offline, after restarts, and after the session token expires.
  const session = useAppSession();

  if (session.status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-kyar-bg dark:bg-kyar-dark-bg">
        <ActivityIndicator />
      </View>
    );
  }

  if (session.status === "signedOut") {
    return <Redirect href={APP_HREF.signIn} />;
  }

  if (session.status === "vaultError") {
    return <VaultErrorScreen message={session.message} />;
  }

  return (
    <>
      {/* In-app chrome is glass-dark on every screen (QA-6) — light status icons. */}
      <StatusBar style="light" />
      <Stack
        key={session.account.subject}
        screenOptions={{
          // Glass chrome defaults for screens that opt into a header
          // (discover, feed, itinerary, packing) — headers stay hidden unless
          // a screen shows one.
          ...glassHeaderOptions(),
          headerShown: false,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
    </>
  );
}
