import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Host-based landing/app split. This is INERT except on the exact production hostnames below,
// so local dev, Vercel preview URLs, and any other host pass through unchanged. It only takes
// effect once DNS points these hostnames at the deployment.
//
//   www.kyarafit.com / kyarafit.com  → landing site (marketing + legal + public share pages)
//   app.kyarafit.com                 → the app (authed surfaces); "/" redirects to "/home"
//
// Auth lives on *.convex.site and rides the crossDomain/bearer mechanism, so moving the app to
// app.kyarafit.com does not drop sessions (see docs/auth.md).

const APP_HOST = "app.kyarafit.com";
const LANDING_HOSTS = new Set(["www.kyarafit.com", "kyarafit.com"]);

// Paths that stay on the landing site (marketing, legal, and public share pages that benefit from
// the apex/www domain for SEO + link sharing). Everything else on a landing host is an app route
// and is redirected to app.kyarafit.com.
const LANDING_PREFIXES = ["/privacy", "/terms", "/b/", "/g/", "/u/"];

function isLandingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return LANDING_PREFIXES.some(
    (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
  );
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const { pathname, search } = req.nextUrl;

  if (host === APP_HOST) {
    // The app's marketing root redirects into the product.
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }

  if (LANDING_HOSTS.has(host)) {
    // App routes requested on the landing domain are sent to the app subdomain.
    if (!isLandingPath(pathname)) {
      return NextResponse.redirect(
        new URL(`${pathname}${search}`, `https://${APP_HOST}`),
        308,
      );
    }
    return NextResponse.next();
  }

  // Any other host (localhost, 127.0.0.1, preview deployments, LAN IPs): no host routing.
  return NextResponse.next();
}

export const config = {
  // Skip Next internals, API routes, and static assets so only page navigations are routed.
  matcher: ["/((?!_next/|api/|.well-known/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
