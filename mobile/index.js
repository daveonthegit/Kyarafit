/**
 * Expo Router entry with static require.context (fixes EXPO_ROUTER_APP_ROOT in monorepo/SDK 50).
 * @see https://docs.expo.dev/router/reference/troubleshooting/#expo_router_app_root-not-defined
 */
import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

export function App() {
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
