/**
 * Claimed-link association files for the native app (iOS Universal Links, Android App Links).
 * Only `/native/*` is claimed: the OAuth return (`/native/auth/return`) opens the app, while
 * every other web route stays on the web. Values are public identifiers, set per deployment:
 *
 * - APPLE_TEAM_ID: the 10-character Apple Developer Team ID that signs the iOS app.
 * - IOS_BUNDLE_ID: defaults to com.kyarafit.mobile (mobile/app.json `ios.bundleIdentifier`).
 * - ANDROID_PACKAGE: defaults to com.kyarafit.mobile (mobile/app.json `android.package`).
 * - ANDROID_CERT_SHA256_FINGERPRINTS: comma-separated SHA-256 fingerprints of the app signing
 *   certificate(s) (Play App Signing key, plus the upload/EAS key for internal builds).
 *
 * Unconfigured platforms publish nothing (404), so a deployment never claims links for an app
 * identity it cannot prove.
 */

export const CLAIMED_PATHS = ["/native/*"];

type Env = Record<string, string | undefined>;

const TEAM_ID = /^[A-Z0-9]{10}$/;
const APP_ID = /^[A-Za-z0-9.-]+$/;
const ANDROID_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function appleAppSiteAssociation(env: Env) {
  const team = env.APPLE_TEAM_ID?.trim();
  const bundle = env.IOS_BUNDLE_ID?.trim() || "com.kyarafit.mobile";
  if (!team || !TEAM_ID.test(team) || !APP_ID.test(bundle)) return null;
  const appID = `${team}.${bundle}`;
  return {
    applinks: {
      details: [{ appIDs: [appID], components: CLAIMED_PATHS.map((path) => ({ "/": path })) }],
    },
    // Lets ASWebAuthenticationSession complete on the https return (iOS 17.4+).
    webcredentials: { apps: [appID] },
  };
}

export function androidAssetLinks(env: Env) {
  const pkg = env.ANDROID_PACKAGE?.trim() || "com.kyarafit.mobile";
  const fingerprints = (env.ANDROID_CERT_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (!ANDROID_PACKAGE.test(pkg) || !fingerprints.length) return null;
  if (!fingerprints.every((value) => FINGERPRINT.test(value))) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: pkg,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function associationResponse(body: unknown): Response {
  if (!body) return new Response("Not configured", { status: 404 });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
