/**
 * Session-derived identity for public Convex functions.
 *
 * Every public function must derive the acting user from the verified session
 * (`ctx.auth.getUserIdentity()`), never from an argument. Actor arguments
 * (`userId`, `ownerId`, `externalId`, `followerId`) are kept in the validators as
 * `v.optional(v.string())` so already-deployed web and mobile clients keep
 * working, but their values are ignored — see `docs/backend-authorization.md`.
 *
 * Arguments that name a *different* user than the actor (a grantee, a follow
 * target, a member being promoted) are not actor arguments and stay required.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The acting user's `externalId`, taken from the verified session.
 * @throws Error `Unauthorized` when the caller has no session.
 */
export async function requireIdentity(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }
  return identity.subject;
}

/**
 * The acting user's `externalId`, or `null` when the caller has no session.
 * For endpoints that are public by design and must also serve signed-out
 * visitors (share pages, the discover feed, public profiles).
 */
export async function optionalIdentity(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}
