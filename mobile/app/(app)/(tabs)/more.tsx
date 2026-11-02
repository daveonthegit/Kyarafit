import { useCallback, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { APP_HREF } from "@/lib/appRoutes";
import { MobileNavDrawer } from "@/components/navigation/MobileNavDrawer";
import { PhotoBackdrop } from "@/ui/glass";

/**
 * Fallback route for the Menu tab: the tab press itself opens the 13e drawer
 * (see `GlassTabBar`), so this screen only serves deep links — it renders the
 * same drawer over the studio wall and returns home when dismissed.
 */
export default function MoreScreen() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const onClose = useCallback(() => {
    setOpen(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(APP_HREF.home);
    }
  }, [router]);

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop scrim="off" kenBurns={false} />
      <MobileNavDrawer open={open} onClose={onClose} />
    </View>
  );
}
