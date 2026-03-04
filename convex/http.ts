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
// (that env var feeds into trustedOrigins automatically; manually mirror it here too)
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
    ],
  },
});

export default http;
