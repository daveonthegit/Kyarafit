/**
 * URL for static files under `public/` with safe encoding of spaces/special chars.
 */
export function mockAssetUrl(...pathSegments: string[]): string {
  return `/${pathSegments.map((s) => encodeURIComponent(s)).join("/")}`;
}
