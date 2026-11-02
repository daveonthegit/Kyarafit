import { useLocalSearchParams } from "expo-router";
import { ChangesNotAppliedScreen } from "@/screens/sync/ChangesNotAppliedScreen";

export default function SettingsChangesScreen() {
  const params = useLocalSearchParams<{ buildId?: string | string[] }>();
  const buildId = Array.isArray(params.buildId) ? params.buildId[0] : params.buildId;
  return <ChangesNotAppliedScreen buildId={buildId || undefined} />;
}
