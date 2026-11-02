import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { glass } from "@kyarafit/design-system/rn";
import { useAppSession } from "@/lib/auth/appSession";
import { APP_HREF } from "@/lib/appRoutes";

export default function Index() {
  const session = useAppSession();

  if (session.status === "loading") {
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

  // A signed-in account (or a vault error to explain) opens the studio — even offline or with an
  // expired session; only a device with no active account goes to the welcome flow.
  if (session.status === "signedIn" || session.status === "vaultError") {
    return <Redirect href={APP_HREF.home} />;
  }

  return <Redirect href={APP_HREF.welcome} />;
}
