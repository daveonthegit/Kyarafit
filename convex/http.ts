import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./betterAuth/auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, {
  cors: {
    allowedOrigins: [
      // Web (Next.js)
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      // Mobile (Expo Go dev – add exp://YOUR_IP:8081 in Convex env if needed)
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "exp://localhost:8081",
      "exp://127.0.0.1:8081",
    ],
  },
});

export default http;
