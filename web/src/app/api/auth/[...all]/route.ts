import { handler } from "@/lib/auth/auth-server";
import { checkAuthRateLimit } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

async function withRateLimit(request: Request, method: "GET" | "POST"): Promise<Response> {
  const ip = getClientIp(request);
  const result = checkAuthRateLimit(ip);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter ?? 60),
      },
    });
  }
  return handler[method](request);
}

export async function GET(request: Request): Promise<Response> {
  return withRateLimit(request, "GET");
}

export async function POST(request: Request): Promise<Response> {
  return withRateLimit(request, "POST");
}
