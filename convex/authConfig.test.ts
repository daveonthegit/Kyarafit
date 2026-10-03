import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

let config: typeof import("./betterAuth/auth");
// Synthetic, test-only configuration, never deployed.
const testSecret = "auth-config-local-fixture-not-for-deployment";

beforeAll(async () => {
  vi.stubEnv("BETTER_AUTH_SECRET", testSecret);
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
  it.each(["development", "production", "test"])(
    "requires an explicit signing secret in NODE_ENV=%s",
    (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      vi.stubEnv("BETTER_AUTH_SECRET", "");
      expect(() => config.createAuthOptions({} as never)).toThrow("BETTER_AUTH_SECRET");
      vi.stubEnv("BETTER_AUTH_SECRET", "short");
      expect(() => config.createAuthOptions({} as never)).toThrow("BETTER_AUTH_SECRET");
      vi.stubEnv("BETTER_AUTH_SECRET", testSecret);
      expect(config.createAuthOptions({} as never).secret).toBe(testSecret);
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
    const register = vi.spyOn(config.authComponent, "registerRoutes").mockImplementation(() => {});
    await import("./http");
    expect(register).toHaveBeenCalledWith(expect.anything(), config.createAuth, {
      cors: { allowedOrigins: corsOrigins },
    });
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
    expect(() => config.createAuthOptions({} as never)).toThrow();
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
