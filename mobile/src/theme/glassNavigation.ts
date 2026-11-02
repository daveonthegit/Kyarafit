import { glass } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

/**
 * Glass Studio chrome for React Navigation headers (phase 7.1). Until a
 * screen gains its photo backdrop (7.2+), headers render the opaque glass
 * fallback bar — dark chrome stays legible over still-cream scenes; converted
 * screens switch to `headerTransparent` over their own backdrop.
 */
export function glassHeaderOptions({ transparent = false }: { transparent?: boolean } = {}) {
  return {
    headerShown: true as const,
    headerTintColor: glass.text.fg,
    headerShadowVisible: false as const,
    headerTransparent: transparent,
    headerStyle: transparent
      ? { backgroundColor: "transparent" }
      : { backgroundColor: glass.fallback.bar },
    headerTitleStyle: {
      fontFamily: APP_FONT_FAMILIES.displayItalic,
      fontSize: 17,
      color: glass.text.fg,
    },
  };
}
