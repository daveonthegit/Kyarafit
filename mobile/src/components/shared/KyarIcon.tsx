import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";

type MaterialName = NonNullable<ComponentProps<typeof MaterialIcons>["name"]>;

/**
 * Maps semantic keys used across Kyarafit (aligned with web Material Symbols) to
 * Material Icons glyph names for React Native.
 */
export type KyarIconName =
  | "home"
  | "layers"
  | "checkroom"
  | "event_note"
  | "menu"
  | "person"
  | "settings"
  | "calendar_today"
  | "groups"
  | "explore"
  | "rss_feed"
  | "arrow_back"
  | "chevron_right"
  | "search"
  | "close"
  | "image"
  | "notifications"
  | "add"
  | "check";

const NAME_TO_MATERIAL: Record<KyarIconName, MaterialName> = {
  home: "home",
  layers: "layers",
  checkroom: "checkroom",
  event_note: "event-note",
  menu: "menu",
  person: "person",
  settings: "settings",
  calendar_today: "calendar-today",
  groups: "group",
  explore: "explore",
  rss_feed: "rss-feed",
  arrow_back: "arrow-back",
  chevron_right: "chevron-right",
  search: "search",
  close: "close",
  image: "image",
  notifications: "notifications",
  add: "add",
  check: "check",
};

export type KyarIconProps = {
  name: KyarIconName;
  size?: number;
  color?: string;
} & Omit<ComponentProps<typeof MaterialIcons>, "name" | "size" | "color">;

/**
 * Single place for icon mapping so we can migrate to a custom Material Symbols font later.
 */
export function KyarIcon({ name, size = 24, color = "#000000", ...rest }: KyarIconProps) {
  return <MaterialIcons name={NAME_TO_MATERIAL[name]} size={size} color={color} {...rest} />;
}
