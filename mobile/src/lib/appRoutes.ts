import type { Href } from "expo-router";

/** Typed-route unions may lag new files until Expo regenerates types; keep paths in one place. */
function href(path: string): Href {
  return path as unknown as Href;
}

export const APP_HREF = {
  home: href("/(app)/(tabs)"),
  builds: href("/(app)/(tabs)/builds"),
  elements: href("/(app)/(tabs)/elements"),
  planner: href("/(app)/(tabs)/planner"),
  more: href("/(app)/(tabs)/more"),
  signIn: href("/(auth)/sign-in"),
  signInResetSuccess: href("/(auth)/sign-in?reset=success"),
  signUp: href("/(auth)/sign-up"),
  forgotPassword: href("/(auth)/forgot-password"),
  resetPassword: href("/(auth)/reset-password"),
  verifyEmail: (email: string) => href(`/(auth)/verify-email?email=${encodeURIComponent(email)}`),
  settings: href("/settings"),
  settingsAccount: href("/settings/account"),
  settingsSubscription: href("/settings/subscription"),
  settingsNotifications: href("/settings/notifications"),
  settingsOffline: href("/settings/offline"),
  settingsData: href("/settings/data"),
  settingsDevGallery: href("/settings/dev/gallery"),
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
  /** Build detail opened on a specific section (e.g. the Builds pager's Board pill). */
  buildTab: (buildId: string, tab: "summary" | "explorer" | "tasks" | "board" | "updates") =>
    href(`/(app)/b/${buildId}?tab=${tab}`),
  /** Public outfit viewer — used by Discover / Feed / public profile taps. */
  publicBuild: (buildId: string) => href(`/public-builds/${buildId}`),
  /** Unlisted outfit share page parity with web `/b/s/[shareToken]`. */
  publicBuildShare: (shareToken: string) => href(`/b/s/${encodeURIComponent(shareToken)}`),
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
