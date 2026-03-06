// Shared design system. For RN tokens use: import { ... } from "@kyarafit/design-system/rn"
// For web, extend Tailwind with design-system/tailwind.config.js theme.
// For shared types (e.g. ClosetItem): import { ... } from "@kyarafit/design-system/types"
export * from "./rn_tokens";
export * from "./types";
export {
  NAV_SECTIONS,
  NAV_SECTIONS_PRIMARY,
  NAV_SECTION_SETTINGS,
  NAV_SECTIONS_BOTTOM,
  ADD_MENU_ITEMS,
  getActiveSection,
  type NavSection,
  type NavSectionId,
  type AddMenuItem,
} from "./navConfig";
