# User Sync System

## Overview

The backend now maintains comprehensive user information synchronized from Supabase Auth and Stripe, including:

- Basic user info (email, email confirmation status)
- Subscription tier and status
- Stripe customer and subscription IDs
- Usage tracking and storage quotas

## Database Schema

### app_users Table

| Column                            | Type        | Description                                           |
| --------------------------------- | ----------- | ----------------------------------------------------- |
| `id`                              | TEXT        | Primary key, matches auth provider user ID            |
| `email`                           | TEXT        | User's email address                                  |
| `email_confirmed`                 | BOOLEAN     | Whether email is verified                             |
| `tier`                            | TEXT        | User tier: ANON, FREE, PREMIUM_BASIC, PREMIUM_PRO     |
| `current_usage_mb`                | INTEGER     | Current storage usage in MB                           |
| `created_at`                      | TIMESTAMPTZ | Account creation timestamp                            |
| `last_sign_in_at`                 | TIMESTAMPTZ | Last sign-in timestamp                                |
| `metadata`                        | JSONB       | Additional user metadata from auth provider           |
| `stripe_customer_id`              | TEXT        | Stripe customer ID                                    |
| `stripe_subscription_id`          | TEXT        | Current Stripe subscription ID                        |
| `subscription_status`             | TEXT        | Subscription status: active, canceled, past_due, etc. |
| `subscription_current_period_end` | TIMESTAMPTZ | When current billing period ends                      |

## Automatic Sync Mechanisms

### 1. Supabase Auth Trigger (Migration 008)

When a user signs up or updates their profile in Supabase Auth:

```sql
-- Automatically triggered on INSERT or UPDATE to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

This syncs:

- Email address
- Email confirmation status
- Last sign-in time
- User metadata

### 2. Backend GetOrCreate (On Every API Request)

When a user makes an authenticated API request, the middleware calls `userRepo.GetOrCreate()` which:

1. Loads user from `app_users` table
2. If not found, creates with tier=FREE
3. Loads active subscription data
4. Returns complete user object for authorization checks

### 3. Stripe Webhooks (Subscription Changes)

Handle Stripe events to keep subscription status in sync:

#### Supported Events

**`customer.created`**

- Stores Stripe customer ID when customer is created
- Links customer to user via metadata

**`customer.subscription.created` / `customer.subscription.updated`**

- Updates tier based on price ID
- Updates subscription status (active, trialing, past_due)
- Updates current period end date

**`customer.subscription.deleted`**

- Downgrades user to FREE tier
- Keeps subscription_id for history
- Does NOT delete user data

## API Endpoints

### Get User Info

```
GET /api/v1/users/me
Authorization: Bearer <jwt-token>
```

Returns:

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "emailConfirmed": true,
  "tier": "PREMIUM_BASIC",
  "currentUsageMb": 45,
  "storageLimitMb": 500,
  "stripeCustomerId": "cus_xxx",
  "stripeSubscriptionId": "sub_xxx",
  "subscriptionStatus": "active",
  "subscriptionCurrentPeriodEnd": "2026-03-04T10:30:00Z"
}
```

### Sync User Info (Manual Refresh)

```
POST /api/v1/users/sync
Authorization: Bearer <jwt-token>
```

Fetches latest user info from database and returns updated data.

### Legacy /me Endpoint (Minimal Info)

```
GET /api/v1/me
Authorization: Bearer <jwt-token>
```

Returns basic tier and usage info (for backward compatibility).

## Repository Methods

### User Lookup

```go
// Get user by ID
user, err := userRepo.GetByID(ctx, userID)

// Get or create user (used in auth middleware)
user, err := userRepo.GetOrCreate(ctx, userID)

// Get user by Stripe customer ID
user, err := userRepo.GetByStripeCustomerID(ctx, customerID)
```

### Subscription Management

```go
// Update Stripe customer ID
err := userRepo.UpdateStripeCustomer(ctx, userID, customerID)

// Update subscription details
err := userRepo.UpdateSubscription(ctx, userID, subscriptionID, "active", &periodEnd)

// Update tier and subscription atomically
err := userRepo.SetTierAndSubscription(ctx, userID, tier.PREMIUM_PRO, subID, "active", &periodEnd)

// Manual sync from auth provider
err := userRepo.SyncFromAuth(ctx, userID, email, emailConfirmed)
```

### Usage Tracking

```go
// Update storage usage (can be negative to decrease)
err := userRepo.UpdateUsage(ctx, userID, deltaMB)

// Count user's builds and conventions
buildCount, err := userRepo.CountBuilds(ctx, userID)
conventionCount, err := userRepo.CountConventions(ctx, userID)
```

## Setup Instructions

### 1. Run Migration

The enhanced user sync is in migration 008. Run it on your database:

```bash
# If using local postgres
go run cmd/migrate/main.go up

# If using Supabase
# Copy migration 008 to Supabase SQL Editor and run it
```

### 2. Configure Stripe Webhook

In Stripe Dashboard → Developers → Webhooks:

1. Add endpoint: `https://your-domain.com/webhooks/stripe`
2. Select events to listen for:
   - `customer.created`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Get webhook signing secret
4. Add to backend `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

### 3. Set Metadata When Creating Stripe Customers

When creating a Stripe customer from your app, include user_id in metadata:

```typescript
const customer = await stripe.customers.create({
  email: user.email,
  metadata: {
    user_id: user.id, // This links Stripe customer to your user
  },
});
```

### 4. Configure Price IDs

In backend `.env`:

```
STRIPE_PRICE_BASIC=price_xxx  # Premium Basic monthly price
STRIPE_PRICE_PRO=price_yyy    # Premium Pro monthly price
```

## Security Considerations

### ⚠️ Important: Webhook Security

The Stripe webhook handler is **DISABLED by default** because it lacks signature verification.

Before enabling in production:

1. Install Stripe Go SDK: `go get github.com/stripe/stripe-go/v76`
2. Implement signature verification
3. Uncomment webhook route in `main.go`

Example verification code:

```go
signature := c.Get("Stripe-Signature")
event, err := webhook.ConstructEvent(c.Body(), signature, webhookSecret)
if err != nil {
    return c.Status(400).JSON(fiber.Map{"error": "invalid signature"})
}
```

### Supabase Trigger Security

The `handle_new_user()` function uses `SECURITY DEFINER`, which means it runs with the permissions of the function owner. This is necessary to insert into `app_users` from the auth schema.

Ensure:

- Function only performs the intended sync operations
- No untrusted user input is used in queries
- Function is reviewed before deployment

## Testing

### Test User Sync

1. Sign up a new user in your app
2. Check that `app_users` table has a new row with tier=FREE
3. Verify email and other fields are synced

```sql
SELECT * FROM app_users WHERE email = 'test@example.com';
```

### Test Stripe Webhook (Locally)

Use Stripe CLI to forward webhooks to localhost:

```bash
stripe listen --forward-to localhost:8080/webhooks/stripe
stripe trigger customer.subscription.created
```

Check backend logs for webhook processing messages.

### Test API Endpoints

```bash
# Get user info
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/v1/users/me

# Sync user info
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/v1/users/sync
```

## Troubleshooting

### User not synced from Supabase

- Check that migration 008 ran successfully
- Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Check Supabase logs for errors

### Stripe webhook not updating user

- Verify `STRIPE_WEBHOOK_SECRET` is set
- Check that customer has `user_id` in metadata
- Review backend logs for error messages
- Confirm webhook endpoint is accessible from Stripe

### Email not syncing

- Email sync only works on Supabase (not local postgres)
- Check that auth schema exists
- Verify user has confirmed email in Supabase Auth

## Future Enhancements

Potential improvements to consider:

1. **Real-time sync**: Use Supabase Realtime to push user changes to connected clients
2. **Audit log**: Track tier changes and subscription events
3. **Grace period**: Allow continued access for N days after subscription cancellation
4. **Usage alerts**: Notify users when approaching storage limits
5. **Admin dashboard**: View and manage user tiers and subscriptions
6. **Batch sync**: Periodic job to sync all users from Supabase Auth

## Migration from Old System

If you have existing users:

1. Run migration 008 - it will sync existing `auth.users` to `app_users`
2. Existing `app_users` rows keep their tier (not overwritten)
3. Email and metadata will be populated for existing users
4. No data loss occurs

## API Changes

### New Fields in User Object

The `tier.User` struct now includes:

- `Email`
- `EmailConfirmed`
- `StripeCustomerID`
- `StripeSubscriptionID`
- `SubscriptionStatus`
- `SubscriptionCurrentPeriodEnd`

These fields are available in handlers via `middleware.AppUser(c)`.

### Backward Compatibility

Existing endpoints continue to work. The `/api/v1/me` endpoint returns the original minimal response for compatibility.

New endpoints `/api/v1/users/me` and `/api/v1/users/sync` provide extended info.
