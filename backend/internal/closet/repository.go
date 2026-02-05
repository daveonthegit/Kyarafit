package closet

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository handles closet_items persistence.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository returns a new closet repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func rowToItem(r itemRow) Item {
	it := Item{
		ID: r.ID, Name: r.Name, Category: r.Category,
		Notes: r.Notes, ImageURL: r.ImageURL, CostCents: r.CostCents,
		CreatedAt: r.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: r.UpdatedAt.UTC().Format(time.RFC3339),
	}
	if len(r.Tags) > 0 {
		_ = json.Unmarshal(r.Tags, &it.Tags)
	}
	return it
}

// ListByDevice returns items for device_id ordered by updated_at desc.
func (r *Repository) ListByDevice(ctx context.Context, deviceID string) ([]Item, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, device_id, name, category, tags, notes, image_url, cost_cents, created_at, updated_at
		FROM closet_items WHERE device_id = $1 ORDER BY updated_at DESC
	`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var row itemRow
		err := rows.Scan(
			&row.ID, &row.DeviceID, &row.Name, &row.Category, &row.Tags,
			&row.Notes, &row.ImageURL, &row.CostCents, &row.CreatedAt, &row.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, rowToItem(row))
	}
	return items, rows.Err()
}

// GetByID returns one item by id and device_id, or nil if not found.
func (r *Repository) GetByID(ctx context.Context, id, deviceID string) (*Item, error) {
	var row itemRow
	err := r.pool.QueryRow(ctx, `
		SELECT id, device_id, name, category, tags, notes, image_url, cost_cents, created_at, updated_at
		FROM closet_items WHERE id = $1 AND device_id = $2
	`, id, deviceID).Scan(
		&row.ID, &row.DeviceID, &row.Name, &row.Category, &row.Tags,
		&row.Notes, &row.ImageURL, &row.CostCents, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	it := rowToItem(row)
	return &it, nil
}

// Create inserts a new item and returns it. userID is optional (for tier attribution).
func (r *Repository) Create(ctx context.Context, deviceID, userID string, in CreateInput) (Item, error) {
	id := uuid.New().String()
	tagsJSON, _ := json.Marshal(in.Tags)
	_, err := r.pool.Exec(ctx, `
		INSERT INTO closet_items (id, device_id, user_id, name, category, tags, notes, image_url, cost_cents)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9)
	`, id, deviceID, userID, in.Name, in.Category, tagsJSON, in.Notes, in.ImageURL, in.CostCents)
	if err != nil {
		return Item{}, err
	}
	got, err := r.GetByID(ctx, id, deviceID)
	if err != nil || got == nil {
		return Item{}, err
	}
	return *got, nil
}

// Update updates an item by id and device_id (last-write-wins). Returns the updated item or nil if not found.
func (r *Repository) Update(ctx context.Context, id, deviceID string, in UpdateInput) (*Item, error) {
	existing, err := r.GetByID(ctx, id, deviceID)
	if err != nil || existing == nil {
		return nil, err
	}
	if in.Name != nil {
		existing.Name = *in.Name
	}
	if in.Category != nil {
		existing.Category = *in.Category
	}
	if in.Tags != nil {
		existing.Tags = in.Tags
	}
	if in.Notes != nil {
		existing.Notes = in.Notes
	}
	if in.ImageURL != nil {
		existing.ImageURL = in.ImageURL
	}
	if in.CostCents != nil {
		existing.CostCents = in.CostCents
	}
	tagsJSON, _ := json.Marshal(existing.Tags)
	_, err = r.pool.Exec(ctx, `
		UPDATE closet_items SET name = $2, category = $3, tags = $4, notes = $5, image_url = $6, cost_cents = $7
		WHERE id = $1 AND device_id = $8
	`, id, existing.Name, existing.Category, tagsJSON, existing.Notes, existing.ImageURL, existing.CostCents, deviceID)
	if err != nil {
		return nil, err
	}
	// Re-fetch to get updated_at from trigger
	updated, _ := r.GetByID(ctx, id, deviceID)
	return updated, nil
}

// Delete removes an item by id and device_id. Returns true if a row was deleted.
func (r *Repository) Delete(ctx context.Context, id, deviceID string) (bool, error) {
	res, err := r.pool.Exec(ctx, `DELETE FROM closet_items WHERE id = $1 AND device_id = $2`, id, deviceID)
	if err != nil {
		return false, err
	}
	return res.RowsAffected() > 0, nil
}
