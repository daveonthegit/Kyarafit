import { View } from "react-native";
import { colors, radius } from "@kyarafit/design-system/rn";

export type ProgressBarProps = {
  /** 0–100 */
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
};

export function ProgressBar({
  progress,
  height = 4,
  trackColor = "rgba(0,0,0,0.05)",
  fillColor = colors.text,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <View
      style={{
        width: "100%",
        height,
        borderRadius: radius.sm,
        backgroundColor: trackColor,
        overflow: "hidden",
      }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: fillColor }} />
    </View>
  );
}
