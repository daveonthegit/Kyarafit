# Subscription Service: Stripe Webhook and Checkout

Implement **Stripe webhook signature verification** and re-enable the endpoint, then add **Checkout or Customer Portal** so users can upgrade and manage subscriptions. Do steps in order; each has a **Cursor prompt**.

---

## Goal

- **Current gap**: Backend has Stripe-related fields and repo methods ([backend/internal/appuser/repository.go](backend/internal/appuser/repository.go)) but the Stripe webhook is **disabled** (unverified signature; see [SECURITY_FIXES.md](SECURITY_FIXES.md)). No frontend flow to start or manage a subscription.
- **Target**: (1) Verify Stripe webhook signature and re-enable `POST /webhooks/stripe`; handle subscription lifecycle and update user tier. (2) Provide an API that returns a Checkout or Customer Portal URL; frontend opens it from settings.

---

## Prerequisites

- [backend/internal/appuser/repository.go](backend/internal/appuser/repository.go): UpdateStripeCustomer, UpdateSubscription, SetTierAndSubscription, GetByStripeCustomerID.
- Stripe webhook handler exists but is commented out or returns 500 when STRIPE_WEBHOOK_SECRET is unset. See [docs/implementation/USER_SYNC_SYSTEM.md](USER_SYNC_SYSTEM.md) and [docs/setup/QUICKSTART_SUPABASE.md](../setup/QUICKSTART_SUPABASE.md).
- Env: STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO (or equivalent).

---

## Step 1: Backend — verify Stripe webhook signature and re-enable route

**What to do**

- Add the Stripe Go SDK if not present: `go get github.com/stripe/stripe-go/v76`. In the webhook handler: read the raw request body and the `Stripe-Signature` header; use `stripe.ConstructEvent(body, signature, webhookSecret)` (or equivalent) to verify. If verification fails, return 400. If secret is unset, return 500 (do not process). On success, parse the event and handle `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` (and optionally `customer.created` to link Stripe customer ID). In subscription events, get the customer ID and subscription details; look up user by Stripe customer ID; call SetTierAndSubscription (or UpdateSubscription) to update tier and subscription fields. Re-enable the route `app.Post("/webhooks/stripe", stripeWebhookHandler(...))`.

**Files to touch**

- Backend main.go or handler file that defines the Stripe webhook handler; backend go.mod for stripe-go.

**Cursor prompt**

```
In the Kyarafit backend, implement Stripe webhook signature verification and re-enable the webhook: (1) Add github.com/stripe/stripe-go/v76. (2) In the webhook handler, read raw body and Stripe-Signature header; verify with stripe.ConstructEvent(body, signature, os.Getenv("STRIPE_WEBHOOK_SECRET")); if secret empty return 500, if invalid signature return 400. (3) Handle customer.subscription.created/updated/deleted: parse subscription, get customer ID, look up user by GetByStripeCustomerID, call SetTierAndSubscription or UpdateSubscription to set tier (e.g. PREMIUM_BASIC/PREMIUM_PRO from price ID) and subscription status/period end. (4) Re-enable POST /webhooks/stripe. See docs/implementation/USER_SYNC_SYSTEM.md. Run go build ./...
```

---

## Step 2: Backend — create Checkout or Customer Portal session endpoint

**What to do**

- Add an authenticated endpoint (e.g. `POST /api/v1/subscription/checkout` or `POST /api/v1/subscription/portal`) that: (1) Gets the current user ID from JWT. (2) If checkout: creates a Stripe Checkout Session with the desired price (STRIPE_PRICE_BASIC or PREMIUM_PRO), success/cancel URLs, and customer_email or existing Stripe customer ID from user record; returns `{ url: session.URL }`. (3) If portal: creates a Stripe Customer Portal session for the user's stripe_customer_id and returns `{ url }`. Frontend will redirect the user to that URL. Use Stripe Go SDK. Require auth (e.g. requireWeb middleware).

**Files to touch**

- Backend: new handler and route; optionally new file internal/subscription or similar.

**Cursor prompt**

```
In the Kyarafit backend, add an authenticated endpoint for subscription: (1) POST /api/v1/subscription/checkout (or similar) that creates a Stripe Checkout Session for the current user (use STRIPE_PRICE_BASIC or allow price param), sets success_url and cancel_url, and returns { url: session.URL }. (2) Or POST /api/v1/subscription/portal that creates a Customer Portal session for the user's stripe_customer_id and returns { url }. (3) Require JWT (requireWeb or equivalent). (4) If user has no stripe_customer_id yet, create a Stripe customer first and save it via UpdateStripeCustomer. Use Stripe Go SDK. Run go build ./...
```

---

## Step 3: Frontend — upgrade / manage button in settings

**What to do**

- In the Subscription Plan settings page (see [SETTINGS_AND_MENUS.md](SETTINGS_AND_MENUS.md)), add a button that calls the new backend endpoint (e.g. POST /api/v1/subscription/checkout with auth header), gets the URL from the response, and redirects the user (window.location.href = url). For "Manage subscription", call the portal endpoint and redirect. Handle errors (e.g. show message if request fails).

**Files to touch**

- [web/src/app/settings/subscription/page.tsx](web/src/app/settings/subscription/page.tsx) or equivalent.

**Cursor prompt**

```
In the Kyarafit web app settings subscription page, wire the upgrade and manage buttons: (1) "Upgrade" button: call POST /api/v1/subscription/checkout with the auth token, get { url } from response, then window.location.href = url. (2) "Manage subscription" button: call POST /api/v1/subscription/portal, get { url }, redirect. (3) Use fetch with Authorization header (session token). (4) On error, show a short message. Run npm run build.
```

---

## Step 4: Env and documentation

**What to do**

- Document STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO (and Stripe API key if used server-side) in env.example and in [docs/setup/QUICKSTART_SUPABASE.md](docs/setup/QUICKSTART_SUPABASE.md) or [USER_SYNC_SYSTEM.md](USER_SYNC_SYSTEM.md). Ensure the webhook endpoint is registered in the Stripe Dashboard with the correct events.

**Files to touch**

- backend/env.example, docs/setup/QUICKSTART_SUPABASE.md or docs/implementation/USER_SYNC_SYSTEM.md.

**Cursor prompt**

```
Document Stripe env vars: add STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO (and STRIPE_SECRET_KEY if used) to backend/env.example and to docs/implementation/USER_SYNC_SYSTEM.md or docs/setup/QUICKSTART_SUPABASE.md. Note that the webhook must be configured in Stripe Dashboard for customer.subscription.* and optionally customer.created. No code logic change.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Verify webhook signature; re-enable route; handle subscription events and update user tier. |
| 2 | Add checkout and/or portal API endpoint; return redirect URL. |
| 3 | Settings subscription page: upgrade and manage buttons redirect to Stripe. |
| 4 | Document Stripe env vars and webhook setup. |
