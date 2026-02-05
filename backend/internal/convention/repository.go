package convention

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Default general essentials (manual items) added on first regen.
var defaultGeneralEssentials = []string{
	"Wig cap", "Pins", "Glue", "Makeup wipes", "Repair tape",
}

// Repository handles conventions, convention_day_plans, packing_list_items.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository returns a new convention repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ListConventionsByDevice returns conventions for device_id.
func (r *Repository) ListConventionsByDevice(ctx context.Context, deviceID string) ([]Convention, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, location, image_url, start_date, end_date, created_at, updated_at
		FROM conventions WHERE device_id = $1 ORDER BY start_date DESC
	`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanConventions(rows)
}

func scanConventions(rows pgx.Rows) ([]Convention, error) {
	var list []Convention
	for rows.Next() {
		var c Convention
		var loc, imageURL *string
		err := rows.Scan(&c.ID, &c.Name, &loc, &imageURL, &c.StartDate, &c.EndDate, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, err
		}
		c.Location = loc
		c.ImageURL = imageURL
		list = append(list, c)
	}
	return list, rows.Err()
}

// GetConventionByID returns a convention by id and device_id.
func (r *Repository) GetConventionByID(ctx context.Context, id, deviceID string) (*Convention, error) {
	var c Convention
	var loc, imageURL *string
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, location, image_url, start_date, end_date, created_at, updated_at
		FROM conventions WHERE id = $1 AND device_id = $2
	`, id, deviceID).Scan(&c.ID, &c.Name, &loc, &imageURL, &c.StartDate, &c.EndDate, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.Location = loc
	c.ImageURL = imageURL
	return &c, nil
}

// CreateConvention inserts a convention. If in.ID is set, that id is used (for offline sync). userID is optional.
func (r *Repository) CreateConvention(ctx context.Context, deviceID, userID string, in CreateConventionInput) (Convention, error) {
	id := in.ID
	if id == "" {
		id = uuid.New().String()
	}
	var c Convention
	var loc, imageURL *string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO conventions (id, device_id, user_id, name, location, image_url, start_date, end_date)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8)
		RETURNING id, name, location, image_url, start_date, end_date, created_at, updated_at
	`, id, deviceID, userID, in.Name, in.Location, in.ImageURL, in.StartDate, in.EndDate).Scan(
		&c.ID, &c.Name, &loc, &imageURL, &c.StartDate, &c.EndDate, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return Convention{}, err
	}
	c.Location = loc
	c.ImageURL = imageURL
	return c, nil
}

// UpdateConvention updates a convention.
func (r *Repository) UpdateConvention(ctx context.Context, id, deviceID string, in UpdateConventionInput) (*Convention, error) {
	existing, err := r.GetConventionByID(ctx, id, deviceID)
	if err != nil || existing == nil {
		return nil, err
	}
	if in.Name != nil {
		existing.Name = *in.Name
	}
	if in.Location != nil {
		existing.Location = in.Location
	}
	if in.ImageURL != nil {
		existing.ImageURL = in.ImageURL
	}
	if in.StartDate != nil {
		existing.StartDate = *in.StartDate
	}
	if in.EndDate != nil {
		existing.EndDate = *in.EndDate
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE conventions SET name = $2, location = $3, image_url = $4, start_date = $5, end_date = $6
		WHERE id = $1 AND device_id = $7
	`, id, existing.Name, existing.Location, existing.ImageURL, existing.StartDate, existing.EndDate, deviceID)
	if err != nil {
		return nil, err
	}
	return r.GetConventionByID(ctx, id, deviceID)
}

// GetPlan returns day plans for a convention (convention must belong to device).
func (r *Repository) GetPlan(ctx context.Context, conventionID, deviceID string) ([]ConventionDayPlan, error) {
	conv, err := r.GetConventionByID(ctx, conventionID, deviceID)
	if err != nil || conv == nil {
		return nil, err
	}
	_ = conv
	rows, err := r.pool.Query(ctx, `
		SELECT id, convention_id, date, build_id, notes
		FROM convention_day_plans WHERE convention_id = $1 ORDER BY date ASC
	`, conventionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []ConventionDayPlan
	for rows.Next() {
		var p ConventionDayPlan
		var buildID, notes *string
		err := rows.Scan(&p.ID, &p.ConventionID, &p.Date, &buildID, &notes)
		if err != nil {
			return nil, err
		}
		p.BuildID = buildID
		p.Notes = notes
		list = append(list, p)
	}
	return list, rows.Err()
}

// ReplacePlan replaces the day plan for a convention (delete all, insert new).
func (r *Repository) ReplacePlan(ctx context.Context, conventionID, deviceID string, plan []DayPlanEntry) error {
	conv, err := r.GetConventionByID(ctx, conventionID, deviceID)
	if err != nil || conv == nil {
		return err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `DELETE FROM convention_day_plans WHERE convention_id = $1`, conventionID)
	if err != nil {
		return err
	}
	for _, e := range plan {
		_, err = tx.Exec(ctx, `
			INSERT INTO convention_day_plans (convention_id, date, build_id, notes)
			VALUES ($1, $2, $3, $4)
		`, conventionID, e.Date, e.BuildID, e.Notes)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// GetPackingList returns packing list items for a convention.
func (r *Repository) GetPackingList(ctx context.Context, conventionID, deviceID string) ([]PackingListItem, error) {
	conv, err := r.GetConventionByID(ctx, conventionID, deviceID)
	if err != nil || conv == nil {
		return nil, err
	}
	_ = conv
	rows, err := r.pool.Query(ctx, `
		SELECT id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at
		FROM packing_list_items WHERE convention_id = $1 ORDER BY date ASC NULLS FIRST, label ASC
	`, conventionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []PackingListItem
	for rows.Next() {
		var p PackingListItem
		var date, buildID, closetItemID *string
		err := rows.Scan(&p.ID, &p.ConventionID, &date, &buildID, &closetItemID, &p.Label, &p.Checked, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		p.Date = date
		p.BuildID = buildID
		p.ClosetItemID = closetItemID
		list = append(list, p)
	}
	return list, rows.Err()
}

// RegeneratePackingList:
// - For each planned day with a build, gather closet items linked to that build.
// - Create packing_list_items for those (dedupe by closet_item_id per convention).
// - Keep any manual "label" items already present (no closet_item_id or manual).
// - Add default General Essentials on first regen if none exist.
func (r *Repository) RegeneratePackingList(ctx context.Context, conventionID, deviceID string) ([]PackingListItem, error) {
	conv, err := r.GetConventionByID(ctx, conventionID, deviceID)
	if err != nil || conv == nil {
		return nil, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Existing items: keep those that are manual (label-only, no closet_item_id from auto)
	// We'll delete only auto-derived rows (those with closet_item_id set from a previous regen).
	// Actually: spec says "Create packing_list_items for those (dedupe by closet_item_id). Keep any manual 'label' items already present."
	// So: 1) Delete all auto-derived items (where we have closet_item_id and they came from build links).
	// 2) Re-add from current plan. 3) Keep items that have no closet_item_id (manual). 4) Add default general essentials if none.
	// Simpler: delete all items that have closet_item_id (auto). Keep items with closet_item_id = null (manual). Then add from plan. Then ensure 5 default general essentials exist if no manual "general" exist.
	_, err = tx.Exec(ctx, `DELETE FROM packing_list_items WHERE convention_id = $1 AND closet_item_id IS NOT NULL`, conventionID)
	if err != nil {
		return nil, err
	}
	// Also we need to remove auto-derived by build: actually the only auto-derived are the ones with closet_item_id. So we deleted them. Now add from plan.
	plans, err := r.getPlanTx(ctx, tx, conventionID)
	if err != nil {
		return nil, err
	}
	seenCloset := make(map[string]struct{})
	for _, p := range plans {
		if p.BuildID == nil || *p.BuildID == "" {
			continue
		}
		itemIDs, err := r.getBuildLinkedClosetItemIDs(ctx, tx, *p.BuildID)
		if err != nil {
			return nil, err
		}
		for _, cid := range itemIDs {
			if _, ok := seenCloset[cid]; ok {
				continue
			}
			seenCloset[cid] = struct{}{}
			// Get closet item name for label
			var label string
			err := tx.QueryRow(ctx, `SELECT name FROM closet_items WHERE id = $1`, cid).Scan(&label)
			if err != nil {
				continue
			}
			id := uuid.New().String()
			_, err = tx.Exec(ctx, `
				INSERT INTO packing_list_items (id, convention_id, date, build_id, closet_item_id, label, checked)
				VALUES ($1, $2, $3, $4, $5, $6, false)
			`, id, conventionID, p.Date, p.BuildID, cid, label)
			if err != nil {
				return nil, err
			}
		}
	}
	// Add default general essentials if none exist (manual items with no date, no build)
	var count int
	err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM packing_list_items WHERE convention_id = $1 AND date IS NULL AND build_id IS NULL`, conventionID).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count == 0 {
		for _, label := range defaultGeneralEssentials {
			_, err = tx.Exec(ctx, `
				INSERT INTO packing_list_items (id, convention_id, label, checked)
				VALUES ($1, $2, $3, false)
			`, uuid.New().String(), conventionID, label)
			if err != nil {
				return nil, err
			}
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetPackingList(ctx, conventionID, deviceID)
}

func (r *Repository) getPlanTx(ctx context.Context, tx pgx.Tx, conventionID string) ([]ConventionDayPlan, error) {
	rows, err := tx.Query(ctx, `SELECT id, convention_id, date, build_id, notes FROM convention_day_plans WHERE convention_id = $1 ORDER BY date`, conventionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []ConventionDayPlan
	for rows.Next() {
		var p ConventionDayPlan
		var buildID, notes *string
		err := rows.Scan(&p.ID, &p.ConventionID, &p.Date, &buildID, &notes)
		if err != nil {
			return nil, err
		}
		p.BuildID = buildID
		p.Notes = notes
		list = append(list, p)
	}
	return list, rows.Err()
}

func (r *Repository) getBuildLinkedClosetItemIDs(ctx context.Context, tx pgx.Tx, buildID string) ([]string, error) {
	rows, err := tx.Query(ctx, `SELECT closet_item_id FROM build_item_links WHERE build_id = $1`, buildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// UpdatePackingItem updates checked/label for a packing item. Item must belong to convention that belongs to device.
func (r *Repository) UpdatePackingItem(ctx context.Context, packingID, deviceID string, in UpdatePackingInput) (*PackingListItem, error) {
	var conventionID string
	err := r.pool.QueryRow(ctx, `SELECT convention_id FROM packing_list_items WHERE id = $1`, packingID).Scan(&conventionID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	conv, err := r.GetConventionByID(ctx, conventionID, deviceID)
	if err != nil || conv == nil {
		return nil, err
	}
	if in.Checked != nil {
		_, err = r.pool.Exec(ctx, `UPDATE packing_list_items SET checked = $2 WHERE id = $1`, packingID, *in.Checked)
		if err != nil {
			return nil, err
		}
	}
	if in.Label != nil {
		_, err = r.pool.Exec(ctx, `UPDATE packing_list_items SET label = $2 WHERE id = $1`, packingID, *in.Label)
		if err != nil {
			return nil, err
		}
	}
	return r.getPackingItemByID(ctx, packingID)
}

func (r *Repository) getPackingItemByID(ctx context.Context, id string) (*PackingListItem, error) {
	var p PackingListItem
	var date, buildID, closetItemID *string
	err := r.pool.QueryRow(ctx, `
		SELECT id, convention_id, date, build_id, closet_item_id, label, checked, created_at, updated_at
		FROM packing_list_items WHERE id = $1
	`, id).Scan(&p.ID, &p.ConventionID, &date, &buildID, &closetItemID, &p.Label, &p.Checked, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	p.Date = date
	p.BuildID = buildID
	p.ClosetItemID = closetItemID
	return &p, nil
}

// AddManualPackingItem adds a manual packing item.
func (r *Repository) AddManualPackingItem(ctx context.Context, conventionID, deviceID string, in AddManualPackingInput) (PackingListItem, error) {
	conv, err := r.GetConventionByID(ctx, conventionID, deviceID)
	if err != nil || conv == nil {
		return PackingListItem{}, err
	}
	id := uuid.New().String()
	_, err = r.pool.Exec(ctx, `
		INSERT INTO packing_list_items (id, convention_id, date, build_id, label, checked)
		VALUES ($1, $2, $3, $4, $5, false)
	`, id, conventionID, in.Date, in.BuildID, in.Label)
	if err != nil {
		return PackingListItem{}, err
	}
	item, err := r.getPackingItemByID(ctx, id)
	if err != nil || item == nil {
		return PackingListItem{}, err
	}
	return *item, nil
}
