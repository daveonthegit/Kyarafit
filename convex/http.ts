import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

// IMPORTANT: Every origin listed here MUST also appear in `trustedOrigins` inside
// `convex/betterAuth/auth.ts`. Better Auth has its own CSRF origin check that runs
// independently of CORS — if an origin passes CORS but is missing from trustedOrigins,
// auth requests will receive 403 Forbidden. See docs/auth.md → "Origin Configuration".
//
// For Expo Go on a physical device, add the LAN IP via the Convex env var:
//   ADDITIONAL_CORS_ORIGINS=exp://192.168.1.42:8081,http://192.168.1.42:8081
// Production: set SITE_URL in Convex dashboard (e.g. https://www.kyarafit.com).
// Must match trustedOrigins in convex/betterAuth/auth.ts — we include SITE_URL and
// ADDITIONAL_CORS_ORIGINS here so CORS preflight passes for those origins.
const extraCorsOrigins = [
  ...(process.env.SITE_URL ? [process.env.SITE_URL.replace(/\/$/, "")] : []),
  ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter((s): s is string => s.length > 0) ?? []),
];
authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [
      // Web (Next.js)
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // Mobile (Expo Web / Expo Go dev server)
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "exp://localhost:8081",
      "exp://127.0.0.1:8081",
      ...extraCorsOrigins,
    ],
  },
});

export default http;
