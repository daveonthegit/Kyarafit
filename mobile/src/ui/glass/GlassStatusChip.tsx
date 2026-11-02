import { Text, View } from "react-native";
import { glass, ls, type GlassChipTone } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

/** Semantic tones used across web (`STATUS_TONE_CLASSES`) → glass chip pairs. */
export type GlassStatusTone = "neutral" | "warning" | "active" | "success";

const TONE_TO_CHIP: Record<GlassStatusTone, GlassChipTone> = {
  neutral: "neutral",
  warning: "warn",
  active: "active",
  success: "done",
};

/** Translucent bg/fg pair for a status tone rendered ON GLASS (01-foundations). */
export function glassChipColors(tone: GlassStatusTone) {
  return glass.chip[TONE_TO_CHIP[tone]];
}

/** Status chip on glass — uppercase 10px meta on a translucent tone wash. */
export function GlassStatusChip({
  tone = "neutral",
  label,
}: {
  tone?: GlassStatusTone;
  label: string;
}) {
  const colors = glassChipColors(tone);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: colors.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 10,
          letterSpacing: ls(0.14, 10),
          textTransform: "uppercase",
          color: colors.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
