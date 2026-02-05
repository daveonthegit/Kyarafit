package appuser

import (
	"context"

	"kyarafit-backend/internal/tier"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository handles app_users and subscriptions.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository returns a new app user repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// GetOrCreate returns the app user by id; creates with tier FREE if not found.
func (r *Repository) GetOrCreate(ctx context.Context, id string) (*tier.User, error) {
	u, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if u != nil {
		return u, nil
	}
	_, err = r.pool.Exec(ctx, `INSERT INTO app_users (id, tier, current_usage_mb) VALUES ($1, $2, 0) ON CONFLICT (id) DO NOTHING`, id, tier.FREE)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

// GetByID returns the app user or nil if not found.
func (r *Repository) GetByID(ctx context.Context, id string) (*tier.User, error) {
	var tierStr string
	var usage int
	var email, stripeCustomerID, stripeSubscriptionID, subscriptionStatus string
	var emailConfirmed bool
	var subscriptionCurrentPeriodEnd *string

	query := `
		SELECT 
			tier, 
			current_usage_mb, 
			COALESCE(email, '') as email,
			COALESCE(email_confirmed, false) as email_confirmed,
			COALESCE(stripe_customer_id, '') as stripe_customer_id,
			COALESCE(stripe_subscription_id, '') as stripe_subscription_id,
			COALESCE(subscription_status, '') as subscription_status,
			subscription_current_period_end
		FROM app_users 
		WHERE id = $1
	`

	err := r.pool.QueryRow(ctx, query, id).Scan(
		&tierStr,
		&usage,
		&email,
		&emailConfirmed,
		&stripeCustomerID,
		&stripeSubscriptionID,
		&subscriptionStatus,
		&subscriptionCurrentPeriodEnd,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	u := &tier.User{
		ID:                           id,
		Email:                        email,
		EmailConfirmed:               emailConfirmed,
		Tier:                         tierStr,
		CurrentUsageMB:               usage,
		StripeCustomerID:             stripeCustomerID,
		StripeSubscriptionID:         stripeSubscriptionID,
		SubscriptionStatus:           subscriptionStatus,
		SubscriptionCurrentPeriodEnd: subscriptionCurrentPeriodEnd,
	}

	// Optional: override storage from active subscription
	var quota *int
	_ = r.pool.QueryRow(ctx, `SELECT storage_quota_mb FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`, id).Scan(&quota)
	if quota != nil {
		u.StorageQuotaMB = quota
	}
	return u, nil
}

// SetTier updates the user's tier (e.g. from Stripe webhook).
func (r *Repository) SetTier(ctx context.Context, userID, newTier string) error {
	_, err := r.pool.Exec(ctx, `UPDATE app_users SET tier = $2 WHERE id = $1`, userID, newTier)
	return err
}

// UpdateUsage adds deltaMB to current_usage_mb (can be negative).
func (r *Repository) UpdateUsage(ctx context.Context, userID string, deltaMB int) error {
	_, err := r.pool.Exec(ctx, `UPDATE app_users SET current_usage_mb = GREATEST(0, current_usage_mb + $2) WHERE id = $1`, userID, deltaMB)
	return err
}

// CountBuilds returns the number of builds attributed to the user.
func (r *Repository) CountBuilds(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM device_builds WHERE user_id = $1`, userID).Scan(&n)
	return n, err
}

// CountConventions returns the number of conventions attributed to the user.
func (r *Repository) CountConventions(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM conventions WHERE user_id = $1`, userID).Scan(&n)
	return n, err
}

// UpdateStripeCustomer sets the Stripe customer ID for a user.
func (r *Repository) UpdateStripeCustomer(ctx context.Context, userID, customerID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE app_users SET stripe_customer_id = $2 WHERE id = $1`, userID, customerID)
	return err
}

// UpdateSubscription updates the subscription details for a user.
// This should be called from Stripe webhooks to keep subscription status in sync.
func (r *Repository) UpdateSubscription(ctx context.Context, userID string, subscriptionID, status string, currentPeriodEnd *string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE app_users 
		SET stripe_subscription_id = $2, 
		    subscription_status = $3,
		    subscription_current_period_end = $4
		WHERE id = $1
	`, userID, subscriptionID, status, currentPeriodEnd)
	return err
}

// SetTierAndSubscription updates both tier and subscription info atomically.
// Use this for Stripe webhook handlers to ensure consistency.
func (r *Repository) SetTierAndSubscription(ctx context.Context, userID, newTier, subscriptionID, status string, currentPeriodEnd *string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE app_users 
		SET tier = $2,
		    stripe_subscription_id = $3,
		    subscription_status = $4,
		    subscription_current_period_end = $5
		WHERE id = $1
	`, userID, newTier, subscriptionID, status, currentPeriodEnd)
	return err
}

// GetByStripeCustomerID returns the app user by Stripe customer ID.
func (r *Repository) GetByStripeCustomerID(ctx context.Context, customerID string) (*tier.User, error) {
	var userID string
	err := r.pool.QueryRow(ctx, `SELECT id FROM app_users WHERE stripe_customer_id = $1`, customerID).Scan(&userID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return r.GetByID(ctx, userID)
}

// SyncFromAuth syncs basic user info from an auth provider (e.g., when user updates their profile).
// This is useful if you want to manually trigger a sync outside of Supabase triggers.
func (r *Repository) SyncFromAuth(ctx context.Context, userID, email string, emailConfirmed bool) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO app_users (id, email, email_confirmed, tier, current_usage_mb)
		VALUES ($1, $2, $3, $4, 0)
		ON CONFLICT (id) DO UPDATE SET
			email = EXCLUDED.email,
			email_confirmed = EXCLUDED.email_confirmed
	`, userID, email, emailConfirmed, tier.FREE)
	return err
}
