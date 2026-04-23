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

export const APP_FONT_FAMILIES = {
  sansRegular: "AlbertSans_400Regular",
  sansMedium: "AlbertSans_500Medium",
  sansSemiBold: "AlbertSans_600SemiBold",
  sansBold: "AlbertSans_700Bold",
  display: "BodoniModa_400Regular",
  displayItalic: "BodoniModa_400Regular_Italic",
  displayBold: "BodoniModa_700Bold",
  displayBoldItalic: "BodoniModa_700Bold_Italic",
} as const;

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
