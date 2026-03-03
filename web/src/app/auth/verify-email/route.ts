import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies verification email links to Convex so the link in the email can use the app domain.
 * - With ?token=... (from email): redirect to Convex to verify, then Convex redirects back to app.
 * - Without token (e.g. after signup): show the "check your inbox" page via rewrite.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (token) {
    const convexSiteUrl =
      process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      return NextResponse.json(
        { error: "Auth not configured (missing CONVEX_SITE_URL)" },
        { status: 500 }
      );
    }
    const convexVerifyUrl = `${convexSiteUrl.replace(/\/$/, "")}/auth/verify-email?${searchParams.toString()}`;
    return NextResponse.redirect(convexVerifyUrl);
  }

  // No token: redirect to the "check your inbox" page (preserves query params e.g. email=...)
  const inboxUrl = new URL("/auth/verify-email/inbox", request.url);
  request.nextUrl.searchParams.forEach((value, key) => {
    inboxUrl.searchParams.set(key, value);
  });
  return NextResponse.redirect(inboxUrl);
}
