import { Stack } from "expo-router";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

export default function BuildStackLayout() {
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
        headerTitleStyle: {
          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
          color: colors.text,
        },
        contentStyle: {
          backgroundColor: colors.bg,
        },
      }}
    />
  );
}
