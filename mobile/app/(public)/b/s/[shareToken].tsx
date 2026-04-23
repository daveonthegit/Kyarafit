import { useLocalSearchParams } from "expo-router";
import { PublicBuildDetailScreen } from "@/screens/public-build/PublicBuildDetailScreen";

export default function PublicBuildShareRoute() {
  const rawToken = useLocalSearchParams<{ shareToken: string | string[] }>().shareToken;
  const shareToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  return <PublicBuildDetailScreen buildId={undefined} shareToken={shareToken} />;
}
