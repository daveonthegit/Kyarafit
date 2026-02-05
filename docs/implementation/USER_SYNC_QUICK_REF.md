# User Sync Quick Reference

## Quick Start Checklist

- [ ] Run migration 008: `make migrate-up`
- [ ] Set `JWT_SECRET` in backend/.env
- [ ] Set `DATABASE_URL` in backend/.env
- [ ] (Optional) Set Stripe env vars for subscription sync
- [ ] Test user signup - verify sync to app_users table
- [ ] (Production) Implement Stripe webhook signature verification

## Common Tasks

### Get user info in handler

```go
func myHandler(c *fiber.Ctx) error {
    u := middleware.AppUser(c)
    if u == nil {
        return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
    }
    
    // Access user fields
    email := u.Email
    tier := u.Tier
    subscriptionStatus := u.SubscriptionStatus
    
    // Check capabilities
    if !tier.Can(u, "web_access") {
        return c.Status(403).JSON(fiber.Map{"error": "forbidden"})
    }
    
    return c.JSON(fiber.Map{"user": u})
}
```

### Update user tier

```go
err := userRepo.SetTier(ctx, userID, tier.PREMIUM_BASIC)
```

### Update subscription

```go
err := userRepo.UpdateSubscription(ctx, userID, subID, "active", &periodEnd)
```

### Link Stripe customer

```go
err := userRepo.UpdateStripeCustomer(ctx, userID, customerID)
```

### Get user by Stripe customer ID

```go
user, err := userRepo.GetByStripeCustomerID(ctx, customerID)
```

## API Endpoints

### Get detailed user info
```bash
GET /api/v1/users/me
Authorization: Bearer <jwt>
```

### Sync user info
```bash
POST /api/v1/users/sync
Authorization: Bearer <jwt>
```

### Legacy endpoint (minimal info)
```bash
GET /api/v1/me
Authorization: Bearer <jwt>
```

## Database Queries

### Check user sync status
```sql
SELECT id, email, tier, subscription_status, last_sign_in_at 
FROM app_users 
WHERE email = 'user@example.com';
```

### Find users by tier
```sql
SELECT id, email, tier, subscription_status 
FROM app_users 
WHERE tier = 'PREMIUM_BASIC';
```

### Check subscription status
```sql
SELECT id, email, tier, subscription_status, subscription_current_period_end
FROM app_users 
WHERE subscription_status = 'active';
```

### Find users near storage limit
```sql
SELECT id, email, current_usage_mb, tier
FROM app_users
WHERE tier = 'FREE' AND current_usage_mb > 40;
```

## Environment Variables

### Required
```bash
JWT_SECRET=your-jwt-secret           # For auth token validation
DATABASE_URL=postgresql://...        # Database connection
```

### Optional (Stripe)
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxx     # For webhook signature verification
STRIPE_PRICE_BASIC=price_xxx        # Basic tier price ID
STRIPE_PRICE_PRO=price_yyy          # Pro tier price ID
```

## Stripe Integration

### Create customer with user metadata
```typescript
const customer = await stripe.customers.create({
  email: user.email,
  metadata: {
    user_id: user.id  // Links customer to your user
  }
});
```

### Test webhooks locally
```bash
stripe listen --forward-to localhost:8080/webhooks/stripe
stripe trigger customer.subscription.created
```

## Troubleshooting

### User not syncing from Supabase
1. Check migration 008 ran: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. Check Supabase logs for errors
3. Manually sync: Insert into app_users with email from auth.users

### Stripe webhook not working
1. Verify STRIPE_WEBHOOK_SECRET is set
2. Check webhook endpoint is enabled in main.go
3. Implement signature verification (required for production)
4. Check backend logs for errors

### Email not populated
1. Email sync only works with Supabase (has auth schema)
2. Local postgres won't have email unless manually added
3. Run migration 008 to sync existing users

## Tier Capabilities Reference

```go
// Check if user can do something
tier.Can(u, "web_access")        // true for FREE+
tier.Can(u, "online_backup")     // true for PREMIUM_BASIC+
tier.Can(u, "export_import")     // true for PREMIUM_BASIC+
tier.Can(u, "multi_device_sync") // true for PREMIUM_BASIC+

// Get numeric limits
tier.Limit(u, "storage_mb")      // 50 (FREE), 500 (BASIC), -1 (PRO)
tier.Limit(u, "max_builds")      // 5 (FREE), 20 (BASIC), -1 (PRO)
tier.Limit(u, "max_conventions") // 1 (FREE), 5 (BASIC), -1 (PRO)

// Check tier level
tier.AtLeast(u, tier.PREMIUM_BASIC)  // true if user >= PREMIUM_BASIC
```

## User Struct Fields

```go
type User struct {
    ID                           string   // User ID (UUID)
    Email                        string   // Email address
    EmailConfirmed               bool     // Email verified
    Tier                         string   // ANON, FREE, PREMIUM_BASIC, PREMIUM_PRO
    CurrentUsageMB               int      // Storage used
    StorageQuotaMB               *int     // Custom quota (overrides tier default)
    StripeCustomerID             string   // Stripe customer ID
    StripeSubscriptionID         string   // Active subscription ID
    SubscriptionStatus           string   // active, canceled, past_due, etc.
    SubscriptionCurrentPeriodEnd *string  // ISO8601 timestamp
}
```

## Testing Commands

```bash
# Test health endpoint
curl http://localhost:8080/health

# Test user info endpoint (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8080/api/v1/users/me

# Run test script (bash)
cd backend && ./test_user_sync.sh

# Run test script (PowerShell)
cd backend && .\test_user_sync.ps1

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM app_users;"
```

## Migration Commands

```bash
# Run all pending migrations
cd backend && make migrate-up

# Rollback last migration
make migrate-down

# Check migration status
make migrate-version

# Force version (if needed)
make migrate-force VERSION=008
```

## Documentation Links

- Full documentation: `/USER_SYNC_SYSTEM.md`
- Changelog: `/CHANGELOG_USER_SYNC.md`
- Supabase setup: `/SUPABASE_SETUP.md`
- API docs: `/backend/API_DOCUMENTATION.md`
