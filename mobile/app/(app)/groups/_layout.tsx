import { Stack } from "expo-router";
import { APP_HREF } from "@/lib/appRoutes";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { glassHeaderOptions } from "@/theme/glassNavigation";

export default function GroupsLayout() {
  const { colors } = useDesignTheme();

  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        ...glassHeaderOptions(),
        contentStyle: {
          backgroundColor: colors.bg,
        },
        headerLeft: () => <MobileBackButton surface="glass" fallbackHref={APP_HREF.groups} />,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerLeft: () => <MobileBackButton surface="glass" fallbackHref={APP_HREF.more} />,
        }}
      />
    </Stack>
  );
}
