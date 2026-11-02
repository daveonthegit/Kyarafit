import { components } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function authenticatedEmail(ctx: MutationCtx, subject: string): Promise<string> {
  const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: subject }],
  });
  if (!account) throw new Error("Authenticated account not found");
  return account.email.trim().toLowerCase();
}

export async function verifiedUserByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [
      { field: "email", value: email.trim().toLowerCase() },
      { field: "emailVerified", value: true },
    ],
  });
  if (!account) return null;
  return ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", account._id))
    .unique();
}
