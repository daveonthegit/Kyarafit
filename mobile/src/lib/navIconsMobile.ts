import type { NavSectionId } from "@kyarafit/design-system";

/**
 * Material icon names — same values as web `web/src/lib/navIcons.ts` `NAV_ICON_MAP`.
 * Use with `@expo/vector-icons/MaterialIcons` (glyphs align with Material Symbols used on web).
 */
export const NAV_SECTION_MATERIAL_ICON: Partial<Record<NavSectionId, string>> = {
  home: "home",
  builds: "layers",
  elements: "checkroom",
  events: "event",
  groups: "group",
  planner: "task-alt",
  discover: "explore",
  feed: "newspaper",
  settings: "settings",
  menu: "menu",
};
