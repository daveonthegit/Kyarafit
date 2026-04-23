import {
  borderWidth,
  font,
  getColors,
  layout,
  motion,
  radius,
  shadow,
  spacing,
} from "@kyarafit/design-system/rn";
import { useTheme } from "@/theme/ThemeProvider";

export function useDesignTheme() {
  const { resolvedScheme } = useTheme();

  return {
    scheme: resolvedScheme,
    colors: getColors(resolvedScheme),
    spacing,
    layout,
    radius,
    borderWidth,
    shadow,
    font,
    motion,
  };
}
