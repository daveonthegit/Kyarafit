import { redirect } from "next/navigation";

/**
 * Forwards older verification links to the same-origin auth proxy (`/api/auth/*`), where the
 * session cookie is set first-party; current emails link to `/api/auth/verify-email` directly.
 * - With ?token=...: verify through the proxy, which redirects back into the app.
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
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string") search.set(key, value);
      else if (Array.isArray(value) && value[0]) search.set(key, value[0]);
    });
    redirect(`/api/auth/verify-email?${search.toString()}`);
  }

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") search.set(key, value);
    else if (Array.isArray(value) && value[0]) search.set(key, value[0]);
  });
  redirect(`/auth/verify-email/inbox?${search.toString()}`);
}
