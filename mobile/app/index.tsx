import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { glass } from "@kyarafit/design-system/rn";
import { useSession } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    // Both destinations (studio tabs, welcome) are photo-dark — boot on the
    // studio wall so there is no cream flash.
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: glass.scrim.studioWall.stops[0].color,
        }}
      >
        <ActivityIndicator color={glass.text.fg} />
      </View>
    );
  }

  if (session?.user) {
    return <Redirect href={APP_HREF.home} />;
  }

  return <Redirect href={APP_HREF.welcome} />;
}
