import { Stack } from "expo-router";
import { useDesignTheme } from "@/theme/useDesignTheme";

export default function GroupsLayout() {
  const { colors } = useDesignTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTitleStyle: {
          color: colors.text,
        },
        contentStyle: {
          backgroundColor: colors.bg,
        },
      }}
    />
  );
}
