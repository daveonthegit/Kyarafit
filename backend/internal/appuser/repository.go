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
	err := r.pool.QueryRow(ctx, `SELECT tier, current_usage_mb FROM app_users WHERE id = $1`, id).Scan(&tierStr, &usage)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	u := &tier.User{ID: id, Tier: tierStr, CurrentUsageMB: usage}

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
