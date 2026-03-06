/**
 * Web-only: map shared nav section iconKey to Material Symbols icon names.
 * Keeps design-system platform-agnostic; web owns this mapping.
 */
import type { NavSectionId } from "@kyarafit/design-system";

export const NAV_ICON_MAP: Record<NavSectionId, string> = {
  home: "home",
  builds: "layers",
  todo: "task_alt",
  events: "event",
};
