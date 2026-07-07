import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { hasAdminAccess, hasUnlimitedAccess } from "@kyarafit/design-system/domain/accessPolicy";

/** Load the authenticated caller's `users` row, or throw "Unauthorized" if not signed in / no row. */
async function requireCaller(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Ensures the caller is authenticated and their `users` row grants admin access (`admin` OR `owner`).
 * Role is read server-side from the DB row — never trusted from client input.
 * @throws Error Unauthorized | Forbidden
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireCaller(ctx);
  if (!hasAdminAccess(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Ensures the caller is authenticated and their `users` row is the privileged `owner` role. Only an
 * owner may grant/revoke roles. Role is read server-side from the DB row — never trusted from client.
 * @throws Error Unauthorized | Forbidden
 */
export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireCaller(ctx);
  if (!hasUnlimitedAccess(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}
