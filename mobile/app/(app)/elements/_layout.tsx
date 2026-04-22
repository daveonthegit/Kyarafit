import { Stack } from "expo-router";

export default function ElementsStackLayout() {
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
