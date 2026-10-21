import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  platform: { OS: "ios", Version: "17.4" as string | number },
  openAuthSession: vi.fn(),
  setStoredBearerToken: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: h.platform }));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { BASE64: "base64" },
  getRandomBytes: (n: number) => new Uint8Array(n).fill(7),
  digestStringAsync: async (_: string, value: string) =>
    createHash("sha256").update(value).digest("base64"),
}));
vi.mock("expo-linking", () => ({
  createURL: (path: string) => `kyarafit://${path.replace(/^\//, "")}`,
  parse: (url: string) => ({ queryParams: Object.fromEntries(new URL(url).searchParams) }),
}));
vi.mock("expo-web-browser", () => ({ openAuthSessionAsync: h.openAuthSession }));
vi.mock("@/config/env", () => ({
  EXPO_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  EXPO_PUBLIC_WEB_APP_URL: "https://app.example.invalid",
}));
vi.mock("./client", () => ({
  authClient: { getSession: h.getSession },
  setStoredBearerToken: h.setStoredBearerToken,
}));

const RETURN = "https://app.example.invalid/native/auth/return";

async function load() {
  vi.resetModules();
  return import("./nativeOAuth");
}

function startStub() {
  return vi.fn(async (_input: { fetchOptions: { headers: Record<string, string> } }) => ({
    data: { url: "https://app.example.invalid/api/auth/native/authorize?state=s" },
  }));
}

describe("native OAuth client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.platform.OS = "ios";
    h.platform.Version = "17.4";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ token: "session-token" }))
    );
  });

  it("uses the claimed https return where the auth session supports it, else the scheme", async () => {
    const { nativeReturnURL } = await load();
    expect(nativeReturnURL({ OS: "ios", Version: "17.4" })).toBe(RETURN);
    expect(nativeReturnURL({ OS: "ios", Version: "18.0" })).toBe(RETURN);
    expect(nativeReturnURL({ OS: "android", Version: 34 })).toBe(RETURN);
    expect(nativeReturnURL({ OS: "ios", Version: "17.3" })).toBe("kyarafit://native/auth/return");
    expect(nativeReturnURL({ OS: "android", Version: 34 }, "")).toBe(
      "kyarafit://native/auth/return"
    );
  });

  it("sends a PKCE challenge and redeems the returned code with its verifier", async () => {
    const { runNativeOAuth } = await load();
    const start = startStub();
    h.openAuthSession.mockResolvedValue({ type: "success", url: `${RETURN}?code=abc` });
    await expect(runNativeOAuth("sign-in", start)).resolves.toBe("signed_in");

    const challenge = start.mock.calls[0][0].fetchOptions.headers["x-kyarafit-code-challenge"];
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const { code, verifier } = JSON.parse(String(init.body));
    expect(code).toBe("abc");
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);
    expect(h.openAuthSession).toHaveBeenCalledWith(expect.any(String), RETURN, {
      preferUniversalLinks: true,
    });
    expect(h.setStoredBearerToken).toHaveBeenCalledWith("session-token");
  });

  it("ignores a return link when no sign-in is in progress on this device", async () => {
    const { completeNativeReturn } = await load();
    await expect(completeNativeReturn(`${RETURN}?code=planted`)).resolves.toBe(false);
    await expect(completeNativeReturn("kyarafit://native/auth/return?code=planted")).resolves.toBe(
      false
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(h.setStoredBearerToken).not.toHaveBeenCalled();
  });

  it("redeems once when the auth session and the app link handler both see the return", async () => {
    const { completeNativeReturn, runNativeOAuth } = await load();
    h.openAuthSession.mockImplementation(async () => {
      await completeNativeReturn(`${RETURN}?code=abc`);
      return { type: "success", url: `${RETURN}?code=abc` };
    });
    await expect(runNativeOAuth("sign-in", startStub())).resolves.toBe("signed_in");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("completes an Android scheme fallback after the browser closes", async () => {
    h.platform.OS = "android";
    h.platform.Version = 34;
    const { completeNativeReturn, runNativeOAuth } = await load();
    h.openAuthSession.mockResolvedValue({ type: "dismiss" });
    await expect(runNativeOAuth("sign-in", startStub())).resolves.toBe("pending_redirect");
    await expect(completeNativeReturn("kyarafit://native/auth/return?code=abc")).resolves.toBe(
      true
    );
    expect(h.setStoredBearerToken).toHaveBeenCalledWith("session-token");
  });

  it("surfaces provider errors and does not redeem anything", async () => {
    const { runNativeOAuth } = await load();
    h.openAuthSession.mockResolvedValue({ type: "success", url: `${RETURN}?error=access_denied` });
    await expect(runNativeOAuth("sign-in", startStub())).rejects.toThrow("Sign in failed.");
    expect(fetch).not.toHaveBeenCalled();
  });
});
