import { Stack } from "expo-router";
import { APP_HREF } from "@/lib/appRoutes";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { navHeaderTitleStyle } from "@/theme/appFonts";

export default function BuildStackLayout() {
  const { colors } = useDesignTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        headerBackVisible: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTitleStyle: navHeaderTitleStyle(colors.text),
        contentStyle: {
          backgroundColor: colors.bg,
        },
        headerLeft: () => <MobileBackButton fallbackHref={APP_HREF.builds} />,
      }}
    />
  );
}
