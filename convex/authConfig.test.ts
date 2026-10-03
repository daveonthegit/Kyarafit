import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { convexTest } from "convex-test";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./betterAuth/**"]);

let config: typeof import("./betterAuth/auth");
// Synthetic, test-only configuration, never deployed.
const testSecret = "auth-config-local-fixture-not-for-deployment";

beforeAll(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", undefined);
  config = await import("./betterAuth/auth");
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", testSecret);
  vi.stubEnv("SITE_URL", "https://app.example.invalid");
  vi.stubEnv("CONVEX_SITE_URL", "https://auth.example.invalid");
  vi.stubEnv("AUTH_ENVIRONMENT", "production");
  vi.stubEnv("ADDITIONAL_CORS_ORIGINS", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("auth configuration", () => {
  it.each([32, 48])(
    "accepts an explicitly configured %s-character secret at auth initialization",
    async (length) => {
      const secret = "x".repeat(length); // Synthetic local fixture, not signing material for a deployment.
      vi.stubEnv("BETTER_AUTH_SECRET", secret);
      const auth = config.createAuth({} as never);
      expect(auth.options.secret).toBe(secret);
      expect((await auth.$context).secret).toBe(secret);
      const response = await convexTest(schema, modules).fetch("/auth/ok");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
    }
  );

  it.each([undefined, "", "x".repeat(31)])(
    "imports auth, adapter and HTTP modules before signing configuration is available (%s)",
    async (secret) => {
      vi.resetModules();
      vi.stubEnv("BETTER_AUTH_SECRET", secret);
      const authModule = await import("./betterAuth/auth");
      const adapter = await import("./betterAuth/adapter");
      const router = (await import("./http")).default;
      expect(adapter.create).toBeDefined();
      expect(router.lookup("/auth/get-session", "GET")).not.toBeNull();
      expect(() => authModule.createAuth({} as never)).toThrow("BETTER_AUTH_SECRET");
      const t = convexTest(schema, modules);
      await expect(t.fetch("/auth/ok")).rejects.toThrow("BETTER_AUTH_SECRET");
    }
  );

  it.each(["development", "production", "test"])(
    "requires an explicit signing secret in NODE_ENV=%s",
    (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("BETTER_AUTH_SECRET", "");
      expect(() => config.createAuth({} as never)).toThrow("BETTER_AUTH_SECRET");
      vi.stubEnv("BETTER_AUTH_SECRET", "short");
      expect(() => config.createAuth({} as never)).toThrow("BETTER_AUTH_SECRET");
      vi.stubEnv("BETTER_AUTH_SECRET", testSecret);
      expect(config.createAuth({} as never).options.secret).toBe(testSecret);
    }
  );

  it("shares configured release origins between CORS registration and CSRF", async () => {
    vi.stubEnv(
      "ADDITIONAL_CORS_ORIGINS",
      " https://preview.example.invalid/, https://preview.example.invalid "
    );
    const { corsOrigins, trustedOrigins } = config.getAuthOrigins();
    expect(corsOrigins).toContain("https://preview.example.invalid");
    expect(corsOrigins.filter((o) => o === "https://preview.example.invalid")).toHaveLength(1);
    expect(corsOrigins).not.toContain("http://localhost:3000");
    expect(corsOrigins).not.toContain("exp://localhost:8081");
    expect(trustedOrigins).toEqual(expect.arrayContaining(corsOrigins));
    expect(trustedOrigins).toContain("kyarafit://");
    const options = config.createAuthOptions({} as never);
    expect(options.trustedOrigins()).toEqual(trustedOrigins);
  });

  it("resolves CORS origins at request time from the same policy as CSRF", async () => {
    vi.resetModules();
    vi.stubEnv("SITE_URL", undefined);
    // Import with analysis-time configuration, then provide runtime environment.
    await import("./http");
    vi.stubEnv("SITE_URL", "https://runtime.example.invalid");
    const t = convexTest(schema, modules);
    const preflight = (origin: string) =>
      t.fetch("/auth/get-session", {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
      });
    expect(
      (await preflight("https://runtime.example.invalid")).headers.get(
        "Access-Control-Allow-Origin"
      )
    ).toBe("https://runtime.example.invalid");
    expect(
      (await preflight("http://localhost:3000")).headers.get("Access-Control-Allow-Origin")
    ).toBeNull();
    vi.stubEnv("AUTH_ENVIRONMENT", "development");
    expect(
      (await preflight("http://localhost:3000")).headers.get("Access-Control-Allow-Origin")
    ).toBe("http://localhost:3000");
  });

  it("defaults to production origin restrictions even in a development process", () => {
    vi.stubEnv("AUTH_ENVIRONMENT", undefined);
    vi.stubEnv("NODE_ENV", "development");
    expect(config.getAuthOrigins().corsOrigins).not.toContain("http://localhost:3000");
  });

  it("enables localhost and Expo only on explicitly configured development deployments", () => {
    vi.stubEnv("AUTH_ENVIRONMENT", "development");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("ADDITIONAL_CORS_ORIGINS", "exp://192.0.2.1:8081,http://192.0.2.1:8081");
    const { corsOrigins, trustedOrigins } = config.getAuthOrigins();
    expect(corsOrigins).toContain("exp://localhost:8081");
    expect(corsOrigins).toContain("http://192.0.2.1:8081");
    expect(trustedOrigins).toEqual(expect.arrayContaining(corsOrigins));
  });

  it.each([
    "http://localhost:3000",
    "exp://localhost:8081",
    "https://localhost",
    "https://localhost.",
    "https://127.0.0.2",
    "https://app.localhost",
    "https://[::1]",
    "https://example.invalid/path",
    "https://user:pass@example.invalid",
  ])("rejects invalid production origins: %s", (origin) => {
    vi.stubEnv("ADDITIONAL_CORS_ORIGINS", origin);
    expect(() => config.getAuthOrigins()).toThrow();
  });

  it("rejects invalid environment configuration and production SITE_URL", () => {
    vi.stubEnv("AUTH_ENVIRONMENT", "typo");
    expect(() => config.getAuthOrigins()).toThrow("AUTH_ENVIRONMENT");
    vi.stubEnv("AUTH_ENVIRONMENT", "production");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    expect(() => config.createAuth({} as never)).toThrow();
  });

  it("resets a password, revokes every existing session and allows recovery with the new password", async () => {
    const options = config.createAuthOptions({} as never);
    const store = { user: [], account: [], session: [], verification: [] };
    let resetToken = "";
    const auth = betterAuth({
      ...options,
      database: memoryAdapter(store),
      plugins: [],
      socialProviders: {},
      rateLimit: { enabled: false },
      emailAndPassword: {
        ...options.emailAndPassword,
        requireEmailVerification: false,
        sendResetPassword: async ({ token }) => {
          resetToken = token;
        },
      },
      emailVerification: { sendOnSignUp: false },
    });
    const email = "recovery@example.invalid";
    const signup = await auth.api.signUpEmail({
      body: { email, password: "old-password-fixture", name: "Fixture" },
    });
    const context = await auth.$context;
    await context.internalAdapter.createSession(signup.user.id);
    expect(store.session.length).toBe(2);
    await auth.api.requestPasswordReset({ body: { email } });
    expect(resetToken).not.toBe("");
    await auth.api.resetPassword({
      body: { token: resetToken, newPassword: "new-password-fixture" },
    });
    expect(store.session).toHaveLength(0);
    await expect(
      auth.api.resetPassword({
        body: { token: resetToken, newPassword: "another-password-fixture" },
      })
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({ body: { email, password: "old-password-fixture" } })
    ).rejects.toThrow();
    const recovered = await auth.api.signInEmail({
      body: { email, password: "new-password-fixture" },
    });
    expect(recovered.user.id).toBe(signup.user.id);
    expect(store.session).toHaveLength(1);
  });
});
