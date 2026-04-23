import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { bestConvexTierFromSubscriberEntitlements } from "@kyarafit/design-system/domain/subscriptionTierPolicy";

/**
 * RevenueCat entitlement ids → Convex `users.tier` (`FREE` | `PRO` | `STUDIO`) are defined in
 * `design-system/domain/subscriptionTierPolicy.ts` (`pro`, `studio`, legacy `premium_*`).
 */
function tierFromSubscriberJson(data: {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null }>;
  };
}): string {
  return bestConvexTierFromSubscriberEntitlements(data.subscriber?.entitlements ?? {});
}

/**
 * RevenueCat webhook — register in dashboard → Integrations → Webhooks.
 * URL: `https://<your-deployment>.convex.site/webhooks/revenuecat`
 *
 * Set Convex env: `REVENUECAT_SECRET_API_KEY` (Secret API key from RevenueCat).
 * Optional: `REVENUECAT_WEBHOOK_AUTHORIZATION` — same value as the Authorization header
 * you configure in RevenueCat (we accept `Bearer <token>` or the raw token).
 *
 * On each event we call GET /v1/subscribers/{app_user_id} (recommended by RevenueCat)
 * and map active entitlements to `users.tier`.
 */
export const revenuecatWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const configuredSecret = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  const authHeader = request.headers.get("Authorization");
  if (configuredSecret) {
    const bearer = `Bearer ${configuredSecret}`;
    const ok = authHeader === bearer || authHeader === configuredSecret;
    if (!ok) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    console.warn("[revenuecat] REVENUECAT_SECRET_API_KEY not set; skipping tier sync");
    return new Response("OK", { status: 200 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const event =
    (body as { event?: Record<string, unknown> }).event ?? (body as Record<string, unknown>);
  const type = event.type as string | undefined;
  const appUserId =
    (event.app_user_id as string | undefined) ?? (event.original_app_user_id as string | undefined);

  if (type === "TEST") {
    return new Response("OK", { status: 200 });
  }

  if (!appUserId) {
    return new Response("OK", { status: 200 });
  }

  const subRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!subRes.ok) {
    const text = await subRes.text();
    console.error("[revenuecat] subscriber fetch failed", subRes.status, text);
    return new Response("Upstream error", { status: 500 });
  }

  const subscriberJson = (await subRes.json()) as Parameters<typeof tierFromSubscriberJson>[0];
  const tier = tierFromSubscriberJson(subscriberJson);

  await ctx.runMutation(internal.users.setTier, {
    externalId: appUserId,
    tier,
  });

  return new Response("OK", { status: 200 });
});
