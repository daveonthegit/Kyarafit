import type { NavSectionId } from "@kyarafit/design-system";

/**
 * Maps Expo Router pathname to the nav section that should appear active in the Menu sheet,
 * aligned with `getActiveSection` on web (`design-system/navConfig.ts`).
 */
export function getMobileNavActiveSection(pathname: string | undefined): NavSectionId {
  if (!pathname) return "home";
  const p = pathname;
  if (p.includes("/settings")) return "settings";
  if (p.includes("/feed")) return "feed";
  if (p.includes("/discover")) return "discover";
  if (p.includes("/groups") || p.includes("/g/")) return "groups";
  if (p.includes("/conventions") || p.includes("/itinerary")) return "events";
  if (p.includes("/planner") || p.includes("/packing")) return "planner";
  if (p.includes("/elements")) return "elements";
  if (p.includes("/builds") || p.includes("/b/")) return "builds";
  if (p.includes("/(tabs)/more") || /[/]more$/i.test(p)) return "menu";
  if (
    p.includes("/(tabs)/index") ||
    /\(tabs\)\/?$/i.test(p) ||
    p.endsWith("/(tabs)") ||
    p.endsWith("/(tabs)/")
  ) {
    return "home";
  }
  return "home";
}
