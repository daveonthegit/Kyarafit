import type { Href } from "expo-router";

/** Typed-route unions may lag new files until Expo regenerates types; keep paths in one place. */
function href(path: string): Href {
  return path as unknown as Href;
}

export const APP_HREF = {
  settings: href("/settings"),
  settingsAppearance: href("/settings/appearance"),
  settingsAccount: href("/settings/account"),
  settingsSubscription: href("/settings/subscription"),
  settingsNotifications: href("/settings/notifications"),
  settingsDevGallery: href("/settings/dev/gallery"),
  settingsDevOffline: href("/settings/dev/offline"),
  groups: href("/groups"),
  groupNew: href("/groups/new"),
  group: (groupId: string) => href(`/g/${groupId}`),
  feed: href("/feed"),
  discover: href("/discover"),
  profile: (username: string) => href(`/u/${encodeURIComponent(username)}`),
  conventions: href("/conventions"),
  conventionNew: href("/conventions/new"),
  convention: (conventionId: string) => href(`/conventions/${conventionId}`),
  conventionEdit: (conventionId: string) => href(`/conventions/${conventionId}/edit`),
  conventionPacking: (conventionId: string, day?: string) =>
    href(
      day
        ? `/conventions/${conventionId}/packing?day=${encodeURIComponent(day)}`
        : `/conventions/${conventionId}/packing`
    ),
  packing: href("/packing"),
  itinerary: href("/itinerary"),
  /** Outfit (build) detail — stack route under `(app)/b/[buildId]`. */
  build: (buildId: string) => href(`/(app)/b/${buildId}`),
  /** Public outfit viewer — used by Discover / Feed / public profile taps. */
  publicBuild: (buildId: string) => href(`/(app)/public-builds/${buildId}`),
  buildNew: href("/(app)/b/new"),
  buildLinkElements: (buildId: string) => href(`/(app)/b/link-elements?buildId=${buildId}`),
  /** Cosplay element (node) detail — `(app)/elements/[id]`. */
  element: (cosplayNodeId: string) => href(`/(app)/elements/${cosplayNodeId}`),
  elementNew: href("/(app)/elements/new"),
  elementNewWithType: (nodeType: "element" | "material") =>
    href(`/(app)/elements/new?nodeType=${encodeURIComponent(nodeType)}`),
  elementLinkBuild: (cosplayNodeId: string) =>
    href(`/(app)/elements/link-build?cosplayNodeId=${encodeURIComponent(cosplayNodeId)}`),
  elementEdit: (cosplayNodeId: string) => href(`/(app)/elements/${cosplayNodeId}/edit`),
  elementLinkChild: (parentNodeId: string) =>
    href(`/(app)/elements/link-child?parentNodeId=${encodeURIComponent(parentNodeId)}`),
  elementLinkParent: (childNodeId: string) =>
    href(`/(app)/elements/link-parent?childNodeId=${encodeURIComponent(childNodeId)}`),
} as const;
