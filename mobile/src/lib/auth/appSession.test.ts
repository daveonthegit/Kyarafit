import { describe, expect, it, vi } from "vitest";
import { deriveAppSession } from "./appSession";

vi.mock("./client", () => ({ authClient: { useSession: () => ({}) } }));

/**
 * Offline sign-in contract: once an account has signed in on this device, a missing, failing or
 * expired remote session never locks the user out of their local planner.
 */

const account = { subject: "user_1", name: "Rin", lastVerifiedAt: 1 };
const unlocked = { status: "unlocked" as const, account };
const remote = (overrides: Partial<Parameters<typeof deriveAppSession>[0]> = {}) => ({
  data: null,
  isPending: false,
  error: null,
  ...overrides,
});

describe("deriveAppSession", () => {
  it("opens the studio offline after a restart: a network error is not a sign-out", () => {
    expect(deriveAppSession(remote({ error: { status: 0 } }), unlocked)).toEqual({
      status: "signedIn",
      account,
      connection: "offline",
    });
  });

  it("never waits on the network to open an unlocked vault", () => {
    expect(deriveAppSession(remote({ isPending: true }), unlocked)).toMatchObject({
      status: "signedIn",
      connection: "offline",
    });
  });

  it("keeps an expired session usable and asks to sign in again (no lockout)", () => {
    expect(deriveAppSession(remote(), unlocked)).toEqual({
      status: "signedIn",
      account,
      connection: "expired",
    });
    expect(deriveAppSession(remote({ error: { status: 401 } }), unlocked)).toMatchObject({
      status: "signedIn",
      connection: "expired",
    });
  });

  it("re-validates when back online", () => {
    expect(deriveAppSession(remote({ data: { user: { id: "user_1" } } }), unlocked)).toEqual({
      status: "signedIn",
      account,
      connection: "verified",
    });
  });

  it("requires an account on a device nobody has signed in on", () => {
    expect(deriveAppSession(remote(), { status: "locked" })).toEqual({ status: "signedOut" });
    expect(deriveAppSession(remote({ error: { status: 0 } }), { status: "locked" })).toEqual({
      status: "signedOut",
    });
  });

  it("waits while a confirmed or pending session is unlocking its vault", () => {
    expect(deriveAppSession(remote({ isPending: true }), { status: "locked" })).toEqual({
      status: "loading",
    });
    expect(
      deriveAppSession(remote({ data: { user: { id: "user_2" } } }), { status: "locked" })
    ).toEqual({ status: "loading" });
    expect(deriveAppSession(remote(), { status: "booting" })).toEqual({ status: "loading" });
  });

  it("switches vaults when a different account signs in", () => {
    expect(deriveAppSession(remote({ data: { user: { id: "user_2" } } }), unlocked)).toEqual({
      status: "loading",
    });
  });

  it("explains a vault that cannot be opened instead of wiping it", () => {
    expect(
      deriveAppSession(remote(), { status: "error", account, message: "disk I/O error" })
    ).toEqual({ status: "vaultError", account, message: "disk I/O error" });
  });
});
