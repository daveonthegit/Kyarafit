/**
 * Public web app origin for share links (e.g. https://app.example.com).
 * Falls back to Convex site URL if unset (many deployments use the same host for web + Convex HTTP).
 */
export function getWebAppOrigin(): string {
  const explicit = process.env.EXPO_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "");
  if (explicit) return explicit;
  const site = process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.replace(/\/$/, "");
  return site ?? "";
}

/** Share URL for an unlisted/public build (matches web `/b/s/[shareToken]`). */
export function getBuildShareUrl(shareToken: string): string {
  const origin = getWebAppOrigin();
  if (!origin) return `/b/s/${shareToken}`;
  return `${origin}/b/s/${shareToken}`;
}
