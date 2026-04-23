import { useLocalSearchParams } from "expo-router";
import type { Id } from "convex/_generated/dataModel";
import { PublicBuildDetailScreen } from "@/screens/public-build/PublicBuildDetailScreen";

export default function PublicBuildRoute() {
  const rawBuildId = useLocalSearchParams<{ buildId: string | string[] }>().buildId;
  const buildId = Array.isArray(rawBuildId) ? rawBuildId[0] : rawBuildId;

  return <PublicBuildDetailScreen buildId={buildId as Id<"builds"> | undefined} />;
}
