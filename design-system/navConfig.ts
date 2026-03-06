/**
 * Shared navigation config: single source of truth for app sections (Home, Builds, Todo, Events).
 * Todo = task list (planner); Events = conventions (packing lives per event).
 */
export type NavSectionId = "home" | "builds" | "todo" | "events";

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
  { id: "todo", label: "Todo", path: "/planner", iconKey: "todo" },
  { id: "events", label: "Events", path: "/conventions", iconKey: "events" },
];
