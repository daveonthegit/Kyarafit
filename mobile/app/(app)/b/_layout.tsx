import { Stack } from "expo-router";

export default function BuildStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        headerTintColor: "#171717",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
