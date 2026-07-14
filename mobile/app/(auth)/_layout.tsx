import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { glass } from "@kyarafit/design-system/rn";
import { useSession } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";

/** Auth lives in the photo-dark studio world — no cream, no theme flip. */
const STUDIO_WALL_BG = glass.scrim.studioWall.stops[1].color;

export default function AuthGroupLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: STUDIO_WALL_BG,
        }}
      >
        <StatusBar style="light" />
        <ActivityIndicator color={glass.text.fg} />
      </View>
    );
  }

  if (session?.user) {
    return <Redirect href={APP_HREF.home} />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: STUDIO_WALL_BG },
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
    </>
  );
}
