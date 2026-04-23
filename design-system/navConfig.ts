/**
 * Shared navigation config: single source of truth for app sections.
 * Primary: Home, Builds, Elements, Events, Planner. Secondary: Settings.
 */

export type NavSectionId =
  | "home"
  | "builds"
  | "elements"
  | "events"
  | "groups"
  | "planner"
  | "discover"
  | "feed"
  | "settings"
  | "menu";

export interface NavSection {
  id: NavSectionId;
  label: string;
  path: string;
  /** Icon key for web (Material Symbols) and mobile (Ionicons name or key). */
  iconKey: string;
}

/** Primary nav sections (sidebar/tabs): Home, Builds, Elements, Events, Groups, Planner, Discover, Feed. */
export const NAV_SECTIONS_PRIMARY: NavSection[] = [
  { id: "home", label: "Home", path: "/home", iconKey: "home" },
  { id: "builds", label: "Builds", path: "/builds", iconKey: "builds" },
  { id: "elements", label: "Elements", path: "/elements", iconKey: "elements" },
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

/** Bottom nav (mobile viewport): Home, Builds, Elements, Planner, Menu. */
export const NAV_SECTIONS_BOTTOM: NavSection[] = [
  { id: "home", label: "Home", path: "/home", iconKey: "home" },
  { id: "builds", label: "Builds", path: "/builds", iconKey: "builds" },
  { id: "elements", label: "Elements", path: "/elements", iconKey: "elements" },
  { id: "planner", label: "Planner", path: "/planner", iconKey: "planner" },
  { id: "menu", label: "Menu", path: "#", iconKey: "menu" },
];

/** Add context menu: labelKey for i18n, href for deep links / fallback, modal for in-app overlay. */
export type AddMenuModal = "newBuild" | "newCloset" | "newConvention" | "newGroup";

export interface AddMenuItem {
  labelKey: string;
  href: string;
  /** When set (web), open global creation modal instead of navigating. */
  modal?: AddMenuModal;
}

export const ADD_MENU_ITEMS: AddMenuItem[] = [
  { labelKey: "addBuild", href: "/builds/new", modal: "newBuild" },
  { labelKey: "addElement", href: "/elements/new", modal: "newCloset" },
  { labelKey: "addEvent", href: "/conventions/new", modal: "newConvention" },
  { labelKey: "addGroup", href: "/groups/new", modal: "newGroup" },
];

/**
 * Returns true when the page renders its own contextual FAB (e.g. build detail).
 * When true, the global FAB should be hidden to avoid duplicate floating adds.
 */
export function shouldHideGlobalFAB(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/build-detail");
}

/**
 * Maps pathname to active nav section id. Used for sidebar/bottom nav highlight.
 */
export function getActiveSection(pathname: string | null): NavSectionId {
  if (!pathname) return "home";
  if (pathname.startsWith("/home")) return "home";
  if (pathname.startsWith("/builds") || pathname.startsWith("/build-detail")) return "builds";
  if (pathname.startsWith("/elements") || pathname.startsWith("/closet")) return "elements";
  if (pathname.startsWith("/conventions") || pathname.startsWith("/itinerary")) return "events";
  if (pathname.startsWith("/groups") || pathname.startsWith("/g/")) return "groups";
  if (pathname.startsWith("/planner") || pathname.startsWith("/packing")) return "planner";
  if (pathname.startsWith("/discover")) return "discover";
  if (pathname.startsWith("/feed")) return "feed";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}
