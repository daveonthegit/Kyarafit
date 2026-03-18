/**
 * Shared navigation config: single source of truth for app sections.
 * Primary: Home, Outfits (builds), Closet, Events, Planner. Secondary: Settings.
 */

export type NavSectionId = "home" | "builds" | "closet" | "events" | "groups" | "planner" | "discover" | "feed" | "settings";

export interface NavSection {
  id: NavSectionId;
  label: string;
  path: string;
  /** Icon key for web (Material Symbols) and mobile (Ionicons name or key). */
  iconKey: string;
}

/** Primary nav sections (sidebar/tabs): Home, Outfits, Closet, Events, Groups, Planner, Discover, Feed. */
export const NAV_SECTIONS_PRIMARY: NavSection[] = [
  { id: "home", label: "Home", path: "/home", iconKey: "home" },
  { id: "builds", label: "Outfits", path: "/builds", iconKey: "builds" },
  { id: "closet", label: "Closet", path: "/closet", iconKey: "closet" },
  { id: "events", label: "Events", path: "/conventions", iconKey: "events" },
  { id: "groups", label: "Groups", path: "/groups", iconKey: "groups" },
  { id: "planner", label: "Planner", path: "/planner", iconKey: "planner" },
  { id: "discover", label: "Discover", path: "/discover", iconKey: "discover" },
  { id: "feed", label: "Feed", path: "/feed", iconKey: "feed" },
];

/** Settings section (sidebar below divider, or Profile tab on mobile). */
export const NAV_SECTION_SETTINGS: NavSection = {
  id: "settings",
  label: "Settings",
  path: "/settings",
  iconKey: "settings",
};

/** All sections in order: primary first, then settings. */
export const NAV_SECTIONS: NavSection[] = [...NAV_SECTIONS_PRIMARY, NAV_SECTION_SETTINGS];

/** Bottom nav (mobile viewport): Home, Outfits, Planner, Events, Groups, Profile. */
export const NAV_SECTIONS_BOTTOM: NavSection[] = [
  { id: "home", label: "Home", path: "/home", iconKey: "home" },
  { id: "builds", label: "Outfits", path: "/builds", iconKey: "builds" },
  { id: "planner", label: "Planner", path: "/planner", iconKey: "planner" },
  { id: "events", label: "Events", path: "/conventions", iconKey: "events" },
  { id: "groups", label: "Groups", path: "/groups", iconKey: "groups" },
  NAV_SECTION_SETTINGS,
];

/** Add context menu: labelKey for i18n, href for navigation. */
export interface AddMenuItem {
  labelKey: string;
  href: string;
}

export const ADD_MENU_ITEMS: AddMenuItem[] = [
  { labelKey: "addOutfit", href: "/builds/new" },
  { labelKey: "addItem", href: "/closet/new" },
  { labelKey: "addEvent", href: "/conventions/new" },
];

/**
 * Maps pathname to active nav section id. Used for sidebar/bottom nav highlight.
 */
export function getActiveSection(pathname: string | null): NavSectionId {
  if (!pathname) return "home";
  if (pathname.startsWith("/home")) return "home";
  if (pathname.startsWith("/builds") || pathname.startsWith("/build-detail")) return "builds";
  if (pathname.startsWith("/closet")) return "closet";
  if (pathname.startsWith("/conventions") || pathname.startsWith("/itinerary")) return "events";
  if (pathname.startsWith("/groups") || pathname.startsWith("/g/")) return "groups";
  if (pathname.startsWith("/planner") || pathname.startsWith("/packing")) return "planner";
  if (pathname.startsWith("/discover")) return "discover";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}
