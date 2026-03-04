/**
 * Shared navigation config: single source of truth for app sections (Home, Builds, Plan, Packing).
 * Used by web (BottomNav, WebSidebar) and mobile (tabs) to keep the same information architecture.
 * Platform-specific icons are mapped in each app (e.g. Material Symbols on web, Ionicons on mobile).
 */
export type NavSectionId = "home" | "builds" | "plan" | "packing";

export interface NavSection {
  id: NavSectionId;
  label: string;
  path: string;
  /** Icon key for web (Material Symbols) and mobile (Ionicons name or key). */
  iconKey: string;
}

export const NAV_SECTIONS: NavSection[] = [
  { id: "home", label: "Home", path: "/home", iconKey: "home" },
  { id: "builds", label: "Builds", path: "/builds", iconKey: "builds" },
  { id: "plan", label: "Plan", path: "/conventions", iconKey: "plan" },
  { id: "packing", label: "Packing", path: "/packing", iconKey: "packing" },
];
