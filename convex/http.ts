import { httpRouter } from "convex/server";
import { authComponent, createAuth, getAuthOrigins } from "./betterAuth/auth";
import { revenuecatWebhook } from "./revenuecat";
import { upload, uploadOptions } from "./files";

const http = httpRouter();

http.route({ path: "/media/upload", method: "POST", handler: upload });
http.route({ path: "/media/upload", method: "OPTIONS", handler: uploadOptions });

http.route({
  path: "/webhooks/revenuecat",
  method: "POST",
  handler: revenuecatWebhook,
});

// Convex analyzes this module without runtime env; do not initialize auth here.
// Both CORS and CSRF resolve the same origin policy when handling a request.
authComponent.registerRoutesLazy(http, createAuth, {
  basePath: "/auth",
  cors: true,
  trustedOrigins: () => getAuthOrigins().trustedOrigins,
});

export default http;
