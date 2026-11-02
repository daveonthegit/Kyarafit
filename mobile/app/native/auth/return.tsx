import { Redirect } from "expo-router";

/**
 * Landing route for OAuth return links (claimed https and the kyarafit:// fallback). The code is
 * redeemed by the app-wide link handler in app/_layout.tsx; this route only hands navigation back
 * to the index, which routes by session state.
 */
export default function NativeAuthReturn() {
  return <Redirect href="/" />;
}
