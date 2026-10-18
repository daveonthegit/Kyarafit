import "./mediaTestHelpers.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { createAuthOptions } from "./betterAuth/auth";
import * as helpers from "./emailHelpers";
vi.mock("./emailHelpers", () => ({
  sendWelcomeEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendNotificationEmail: vi.fn(),
}));
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
async function fixture() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  await t.run(async (ctx) => {
    for (const externalId of ["alice", "bob"])
      await ctx.db.insert("users", {
        externalId,
        email: `${externalId}@example.invalid`,
        tier: "PRO",
        currentUsageMb: 0,
      });
  });
  return t;
}
describe("email recipient deletion boundary", () => {
  for (const kind of ["welcome", "verification", "reset", "notification"] as const)
    it(`suppresses deleted ${kind} recipients and preserves active delivery`, async () => {
      const t = await fixture();
      const send = (externalId: string) => {
        const to = `${externalId}@example.invalid`;
        if (kind === "welcome") return t.action(internal.email.sendWelcome, { externalId });
        if (kind === "verification")
          return t.action(internal.email.sendVerification, {
            to,
            url: "https://example.invalid/verify",
          });
        if (kind === "reset")
          return t.action(internal.email.sendPasswordReset, {
            to,
            url: "https://example.invalid/reset",
          });
        return t.action(internal.email.sendNotification, {
          to,
          subject: "Fixture",
          message: "Fixture",
        });
      };
      await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
      await send("alice");
      for (const helper of Object.values(helpers)) expect(helper).not.toHaveBeenCalled();
      await send("bob");
      expect(
        Object.values(helpers).reduce((sum, helper) => sum + vi.mocked(helper).mock.calls.length, 0)
      ).toBe(1);
    });
  it("does not retain address/name in newly queued welcome actions, and suppresses both new and legacy queued sends", async () => {
    const t = convexTest({ schema, modules, transactionLimits: true });
    await t
      .withIdentity({ subject: "alice" })
      .mutation(api.users.upsert, { email: "alice@example.invalid", name: "Fixture name" });
    const queued = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(queued).toHaveLength(1);
    expect(queued[0].args).toEqual([{ externalId: "alice" }]);
    await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
    await t.action(internal.email.sendWelcome, {
      to: "alice@example.invalid",
      name: "Legacy name",
    });
    await Reflect.apply(t.finishAllScheduledFunctions, t, [vi.runAllTimers, 20000]);
    expect(helpers.sendWelcomeEmail).not.toHaveBeenCalled();
  });
  for (const verification of [true, false])
    it(`guards Better Auth ${verification ? "verification" : "reset"} callbacks without blocking fresh signup`, async () => {
      const t = await fixture();
      await t.mutation(internal.accountDeletion.begin, { externalId: "alice" });
      await t.run(async (ctx) => {
        const options = createAuthOptions(ctx);
        const callback = verification
          ? options.emailVerification.sendVerificationEmail
          : options.emailAndPassword.sendResetPassword;
        await callback({
          user: { id: "alice", email: "alice@example.invalid" },
          url: "https://example.invalid/link",
        });
        expect(
          verification ? helpers.sendVerificationEmail : helpers.sendPasswordResetEmail
        ).not.toHaveBeenCalled();
        await callback({
          user: { id: "new-signup", email: "new@example.invalid" },
          url: "https://example.invalid/link",
        });
        expect(
          verification ? helpers.sendVerificationEmail : helpers.sendPasswordResetEmail
        ).toHaveBeenCalledOnce();
      });
    });
});
