import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";

// Next.js proxy (formerly `middleware`): gives every page navigation a per-request nonce-based
// Content-Security-Policy. Host canonicalization lives in next.config.js `redirects()`, which runs
// before this proxy and also covers /api routes: www.kyarafit.com serves the landing site and the
// app together, and the other production hosts redirect there.
//
// Auth is served same-origin at /api/auth (proxied to Convex) with a host-only HttpOnly cookie, so
// a session belongs to the host that set it (see docs/auth.md).

/** Continue to the page with a fresh nonce: Next.js applies it to its scripts via the request CSP. */
export function proxy(req: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip Next internals, API routes, and static assets so only page navigations are routed.
  matcher: ["/((?!_next/|api/|.well-known/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
