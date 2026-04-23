import { Stack } from "expo-router";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { navHeaderTitleStyle } from "@/theme/appFonts";

export default function SettingsLayout() {
  const { colors } = useDesignTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTitleStyle: navHeaderTitleStyle(colors.text),
        contentStyle: {
          backgroundColor: colors.bg,
        },
      }}
    />
  );
}
