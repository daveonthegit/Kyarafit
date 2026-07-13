import { Stack } from "expo-router";
import { APP_HREF } from "@/lib/appRoutes";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { glassHeaderOptions } from "@/theme/glassNavigation";

export default function BuildStackLayout() {
  const { colors } = useDesignTheme();

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerBackVisible: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        ...glassHeaderOptions(),
        contentStyle: {
          backgroundColor: colors.bg,
        },
        headerLeft: () => <MobileBackButton surface="glass" fallbackHref={APP_HREF.builds} />,
      }}
    />
  );
}
