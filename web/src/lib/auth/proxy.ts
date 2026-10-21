import { checkAuthRateLimit } from "@/lib/rate-limit";

/**
 * Same-origin Better Auth proxy policy (`/api/auth/*` → Convex). Browsers hold the session only as
 * an HttpOnly cookie; this keeps the bearer form of that session out of script-readable responses
 * too, so script injected into the page cannot lift a reusable token. The Convex JWT endpoint is
 * the one exception: the Convex client needs that short-lived token to authenticate its socket.
 */

const CONVEX_JWT_PATH = "/api/auth/convex/token";

// Credential, mail-sending and account-changing endpoints. Session and JWT refreshes, which the
// Convex provider polls, are never throttled here (Better Auth applies its own limits upstream).
const RATE_LIMITED = [
  /^\/api\/auth\/sign-in\//,
  /^\/api\/auth\/sign-up\//,
  /^\/api\/auth\/(request-password-reset|reset-password|send-verification-email)$/,
  /^\/api\/auth\/(change-password|set-password|change-email|delete-user)$/,
];

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function withoutSessionTokens(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(withoutSessionTokens);
  if (!body || typeof body !== "object") return body;
  const { token: _token, ...rest } = body as Record<string, unknown>;
  if (rest.session && typeof rest.session === "object") {
    rest.session = withoutSessionTokens(rest.session);
  }
  return rest;
}

export async function proxyAuthRequest(
  request: Request,
  forward: (request: Request) => Promise<Response>
): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method === "POST" && RATE_LIMITED.some((pattern) => pattern.test(pathname))) {
    const limit = checkAuthRateLimit(clientIp(request));
    if (!limit.ok) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 60) } }
      );
    }
  }

  const upstream = await forward(request);
  const headers = new Headers(upstream.headers);
  headers.delete("set-auth-token");
  // fetch already decoded the body, so upstream framing headers no longer describe it.
  headers.delete("content-length");
  headers.delete("content-encoding");
  const isJson = headers.get("content-type")?.includes("application/json");
  if (!isJson || pathname === CONVEX_JWT_PATH) {
    return new Response(upstream.body, { status: upstream.status, headers });
  }
  const text = await upstream.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(text, { status: upstream.status, headers });
  }
  return new Response(JSON.stringify(withoutSessionTokens(body)), {
    status: upstream.status,
    headers,
  });
}
