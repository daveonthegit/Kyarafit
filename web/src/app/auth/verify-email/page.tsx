import { redirect } from "next/navigation";

/**
 * Proxies verification email links to Convex so the link in the email can use the app domain.
 * - With ?token=... (from email): redirect to Convex to verify, then Convex redirects back to app.
 * - Without token (e.g. after signup): redirect to the "check your inbox" page.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = typeof params.token === "string" ? params.token : undefined;
  // Validate token format to avoid header injection / malformed redirects (alphanumeric, max 512 chars)
  const token =
    rawToken && /^[a-zA-Z0-9_-]+$/.test(rawToken) && rawToken.length >= 1 && rawToken.length <= 512
      ? rawToken
      : undefined;

  if (token) {
    const convexSiteUrl = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      throw new Error("Auth not configured (missing CONVEX_SITE_URL)");
    }
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string") search.set(key, value);
      else if (Array.isArray(value) && value[0]) search.set(key, value[0]);
    });
    const convexVerifyUrl = `${convexSiteUrl.replace(/\/$/, "")}/auth/verify-email?${search.toString()}`;
    redirect(convexVerifyUrl);
  }

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") search.set(key, value);
    else if (Array.isArray(value) && value[0]) search.set(key, value[0]);
  });
  redirect(`/auth/verify-email/inbox?${search.toString()}`);
}
