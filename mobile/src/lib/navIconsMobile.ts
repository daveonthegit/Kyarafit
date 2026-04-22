import type { NavSectionId } from "@kyarafit/design-system";

/** Ionicons names for shared nav sections — aligns with web `NAV_ICON_MAP` semantics. */
export const NAV_SECTION_IONICON: Partial<Record<NavSectionId, string>> = {
  home: "home-outline",
  builds: "shirt-outline",
  elements: "grid-outline",
  events: "calendar-outline",
  groups: "people-outline",
  planner: "list-outline",
  discover: "compass-outline",
  feed: "newspaper-outline",
  settings: "settings-outline",
  menu: "menu-outline",
};
