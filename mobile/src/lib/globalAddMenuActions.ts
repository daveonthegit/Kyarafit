import type { Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { AddMenuModal, NavSectionId } from "@kyarafit/design-system";
import { ADD_MENU_ITEMS } from "@kyarafit/design-system";
import { APP_HREF } from "@/lib/appRoutes";
import type { FloatingCreateAction } from "@/ui/FloatingCreateMenu";

/** Same primary modal selection as web `GlobalFAB`. */
const PRIMARY_MODAL_BY_SECTION: Partial<Record<NavSectionId, AddMenuModal>> = {
  builds: "newBuild",
  elements: "newCloset",
  events: "newConvention",
  groups: "newGroup",
  planner: "newBuild",
  home: "newBuild",
  discover: "newBuild",
  feed: "newBuild",
  settings: "newBuild",
};

const MODAL_ICON: Record<AddMenuModal, keyof typeof Ionicons.glyphMap> = {
  newBuild: "shirt-outline",
  newCloset: "cube-outline",
  newConvention: "calendar-outline",
  newGroup: "people-outline",
};

function pushForModal(router: { push: (href: Href) => void }, modal: AddMenuModal) {
  switch (modal) {
    case "newBuild":
      router.push(APP_HREF.buildNew);
      break;
    case "newCloset":
      router.push(APP_HREF.elementNew);
      break;
    case "newConvention":
      router.push(APP_HREF.conventionNew);
      break;
    case "newGroup":
      router.push(APP_HREF.groupNew);
      break;
  }
}

/**
 * Ordered like web global add menu: contextual primary first, then the other `ADD_MENU_ITEMS`.
 */
export function buildGlobalAddMenuActions(
  section: NavSectionId,
  t: (key: string) => string,
  router: { push: (href: Href) => void }
): FloatingCreateAction[] {
  const primaryModal = PRIMARY_MODAL_BY_SECTION[section] ?? "newBuild";
  const primaryItem = ADD_MENU_ITEMS.find((item) => item.modal === primaryModal)!;
  const others = ADD_MENU_ITEMS.filter((item) => item.modal !== primaryModal);
  const ordered = [primaryItem, ...others];

  return ordered.map((item) => {
    const modal = item.modal!;
    return {
      key: modal,
      label: t(`common.${item.labelKey}`),
      icon: MODAL_ICON[modal],
      onPress: () => pushForModal(router, modal),
    };
  });
}
