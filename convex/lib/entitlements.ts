/**
 * Server-side (authoritative) entitlement enforcement for Convex mutations.
 *
 * Client-side gating is best-effort UX; this layer is defense-in-depth + abuse
 * prevention (PRODUCT_SPEC §3, REQ-017/018/019/021). Tier comes from the `users`
 * row keyed by the Better Auth subject (`externalId`); missing rows default to FREE.
 *
 * The feature flags live in the single shared source of truth
 * (`@kyarafit/design-system/domain/entitlements`) so web, mobile, and Convex agree.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  can,
  normalizeTier,
  type Feature,
  type Tier,
} from "@kyarafit/design-system/domain/entitlements";

export type { Tier, Feature } from "@kyarafit/design-system/domain/entitlements";

/** Resolve a user's tier by Better Auth subject. Defaults to "free" when the row is missing. */
export async function getUserTier(ctx: MutationCtx | QueryCtx, userId: string): Promise<Tier> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_externalId", (q) => q.eq("externalId", userId))
    .unique();
  return normalizeTier(user?.tier);
}

/**
 * Throw a clear error when the user's tier may not use `feature`.
 * Use for paid-only actions (e.g. "public_share", "group_create").
 */
export async function requireFeature(
  ctx: MutationCtx | QueryCtx,
  userId: string,
  feature: Feature
): Promise<void> {
  const tier = await getUserTier(ctx, userId);
  if (!can(tier, feature)) {
    throw new Error("This action requires an upgrade.");
  }
}
