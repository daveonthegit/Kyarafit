/**
 * Loaded font-family names — pure constants, safe to import from components
 * under test (no expo-font / native imports). Loading lives in `appFonts.ts`.
 */
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
