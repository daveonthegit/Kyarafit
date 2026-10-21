import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";

// Host-based landing/app split. This is INERT except on the exact production hostnames below,
// so local dev, Vercel preview URLs, and any other host pass through unchanged. It only takes
// effect once DNS points these hostnames at the deployment.
//
//   www.kyarafit.com / kyarafit.com  → landing site (marketing + legal + public share pages)
//   app.kyarafit.com                 → the app (authed surfaces); "/" redirects to "/home"
//
// Auth is served same-origin at /api/auth (proxied to Convex) with a host-only HttpOnly cookie, so
// a session belongs to the host that set it (see docs/auth.md).

const APP_HOST = "app.kyarafit.com";
const LANDING_HOSTS = new Set(["www.kyarafit.com", "kyarafit.com"]);

// Paths that stay on the landing site (marketing, legal, and public share pages that benefit from
// the apex/www domain for SEO + link sharing). Everything else on a landing host is an app route
// and is redirected to app.kyarafit.com.
const LANDING_PREFIXES = ["/privacy", "/terms", "/b/", "/g/", "/u/"];

function isLandingPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return LANDING_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

/** Continue to the page with a fresh nonce: Next.js applies it to its scripts via the request CSP. */
function nextWithCsp(req: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
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
    return nextWithCsp(req);
  }

  if (LANDING_HOSTS.has(host)) {
    // App routes requested on the landing domain are sent to the app subdomain.
    if (!isLandingPath(pathname)) {
      return NextResponse.redirect(new URL(`${pathname}${search}`, `https://${APP_HOST}`), 308);
    }
    return nextWithCsp(req);
  }

  // Any other host (localhost, 127.0.0.1, preview deployments, LAN IPs): no host routing.
  return nextWithCsp(req);
}

export const config = {
  // Skip Next internals, API routes, and static assets so only page navigations are routed.
  matcher: ["/((?!_next/|api/|.well-known/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
