import { ReturnToApp } from "./ReturnToApp";

/**
 * Web fallback for the app's claimed OAuth return link. The OS normally hands
 * `https://<app host>/native/auth/return` to the installed app; this page renders only when it
 * did not (app missing, or the browser kept the navigation). The code it forwards is bound to the
 * app's PKCE verifier, so it is useless to anything but the app that started sign-in.
 */
const FORWARDED = ["code", "error"] as const;
const VALUE = /^[A-Za-z0-9_.-]{1,128}$/;

export default async function NativeAuthReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const forward = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = params[key];
    if (typeof value === "string" && VALUE.test(value)) forward.set(key, value);
  }
  const appLink = `kyarafit://native/auth/return${forward.size ? `?${forward}` : ""}`;

  return <ReturnToApp appLink={appLink} />;
}
