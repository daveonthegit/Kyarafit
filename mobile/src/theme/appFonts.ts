import { useFonts } from "expo-font";
import {
  AlbertSans_400Regular,
  AlbertSans_500Medium,
  AlbertSans_600SemiBold,
  AlbertSans_700Bold,
} from "@expo-google-fonts/albert-sans";
import {
  BodoniModa_400Regular,
  BodoniModa_400Regular_Italic,
  BodoniModa_700Bold,
  BodoniModa_700Bold_Italic,
} from "@expo-google-fonts/bodoni-moda";
import { APP_FONT_FAMILIES } from "./fontFamilies";

export { APP_FONT_FAMILIES } from "./fontFamilies";

/** Navigation bar title — Bodoni italic, aligned with former Builds/Elements page titles. */
export function navHeaderTitleStyle(color: string) {
  return {
    fontFamily: APP_FONT_FAMILIES.displayItalic,
    fontSize: 17,
    color,
  } as {
    fontFamily: string;
    fontSize: number;
    color: string;
  };
}

export function useAppFonts() {
  return useFonts({
    AlbertSans_400Regular,
    AlbertSans_500Medium,
    AlbertSans_600SemiBold,
    AlbertSans_700Bold,
    BodoniModa_400Regular,
    BodoniModa_400Regular_Italic,
    BodoniModa_700Bold,
    BodoniModa_700Bold_Italic,
  });
}
