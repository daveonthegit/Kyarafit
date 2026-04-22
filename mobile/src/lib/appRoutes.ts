import type { Href } from "expo-router";

/** Typed-route unions may lag new files until Expo regenerates types; keep paths in one place. */
function href(path: string): Href {
  return path as unknown as Href;
}

export const APP_HREF = {
  settings: href("/settings"),
  settingsAppearance: href("/settings/appearance"),
  settingsDevGallery: href("/settings/dev/gallery"),
  settingsDevOffline: href("/settings/dev/offline"),
  /** Outfit (build) detail — stack route under `(app)/b/[buildId]`. */
  build: (buildId: string) => href(`/(app)/b/${buildId}`),
  buildNew: href("/(app)/b/new"),
  buildLinkElements: (buildId: string) => href(`/(app)/b/link-elements?buildId=${buildId}`),
  /** Cosplay element (node) detail — `(app)/elements/[id]`. */
  element: (cosplayNodeId: string) => href(`/(app)/elements/${cosplayNodeId}`),
  elementNew: href("/(app)/elements/new"),
  elementLinkBuild: (cosplayNodeId: string) =>
    href(`/(app)/elements/link-build?cosplayNodeId=${encodeURIComponent(cosplayNodeId)}`),
} as const;
