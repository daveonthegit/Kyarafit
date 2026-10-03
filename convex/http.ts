import { httpRouter } from "convex/server";
import { authComponent, createAuth, getAuthOrigins } from "./betterAuth/auth";
import { revenuecatWebhook } from "./revenuecat";

const http = httpRouter();

http.route({
  path: "/webhooks/revenuecat",
  method: "POST",
  handler: revenuecatWebhook,
});

// CORS and CSRF derive from the same configuration, including dev-only origins.
authComponent.registerRoutes(http, createAuth, {
  cors: { allowedOrigins: getAuthOrigins().corsOrigins },
});

export default http;
