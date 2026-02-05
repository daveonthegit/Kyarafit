package builds

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository handles device_builds and build_item_links.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository returns a new builds repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// ListByDevice returns builds for device_id ordered by updated_at desc.
func (r *Repository) ListByDevice(ctx context.Context, deviceID string) ([]Build, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, character, status, notes, image_url, budget_cents, created_at, updated_at
		FROM device_builds WHERE device_id = $1 ORDER BY updated_at DESC
	`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Build
	for rows.Next() {
		var b Build
		var char, notes, imgURL *string
		var budget *int64
		err := rows.Scan(&b.ID, &b.Name, &char, &b.Status, &notes, &imgURL, &budget, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			return nil, err
		}
		b.Character = char
		b.Notes = notes
		b.ImageURL = imgURL
		b.BudgetCents = budget
		list = append(list, b)
	}
	return list, rows.Err()
}

// GetByID returns a build by id and device_id, or nil if not found.
func (r *Repository) GetByID(ctx context.Context, id, deviceID string) (*Build, error) {
	var b Build
	var char, notes, imgURL *string
	var budget *int64
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, character, status, notes, image_url, budget_cents, created_at, updated_at
		FROM device_builds WHERE id = $1 AND device_id = $2
	`, id, deviceID).Scan(&b.ID, &b.Name, &char, &b.Status, &notes, &imgURL, &budget, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	b.Character = char
	b.Notes = notes
	b.ImageURL = imgURL
	b.BudgetCents = budget
	return &b, nil
}

// Create inserts a build and returns it. If in.ID is set, that id is used (for offline sync). userID is optional.
func (r *Repository) Create(ctx context.Context, deviceID, userID string, in CreateBuildInput) (Build, error) {
	status := in.Status
	if status == "" {
		status = "idea"
	}
	id := in.ID
	if id == "" {
		id = uuid.New().String()
	}
	var b Build
	var char, notes, imgURL *string
	var budget *int64
	err := r.pool.QueryRow(ctx, `
		INSERT INTO device_builds (id, device_id, user_id, name, character, status, notes, image_url, budget_cents)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, $7, $8, $9)
		RETURNING id, name, character, status, notes, image_url, budget_cents, created_at, updated_at
	`, id, deviceID, userID, in.Name, in.Character, status, in.Notes, in.ImageURL, in.BudgetCents).Scan(
		&b.ID, &b.Name, &char, &b.Status, &notes, &imgURL, &budget, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return Build{}, err
	}
	b.Character = char
	b.Notes = notes
	b.ImageURL = imgURL
	b.BudgetCents = budget
	return b, nil
}

// Update updates a build by id and device_id. Returns the updated build or nil if not found.
func (r *Repository) Update(ctx context.Context, id, deviceID string, in UpdateBuildInput) (*Build, error) {
	existing, err := r.GetByID(ctx, id, deviceID)
	if err != nil || existing == nil {
		return nil, err
	}
	if in.Name != nil {
		existing.Name = *in.Name
	}
	if in.Character != nil {
		existing.Character = in.Character
	}
	if in.Status != nil {
		existing.Status = *in.Status
	}
	if in.Notes != nil {
		existing.Notes = in.Notes
	}
	if in.ImageURL != nil {
		existing.ImageURL = in.ImageURL
	}
	if in.BudgetCents != nil {
		existing.BudgetCents = in.BudgetCents
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE device_builds SET name = $2, character = $3, status = $4, notes = $5, image_url = $6, budget_cents = $7
		WHERE id = $1 AND device_id = $8
	`, id, existing.Name, existing.Character, existing.Status, existing.Notes, existing.ImageURL, existing.BudgetCents, deviceID)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id, deviceID)
}

// LinkItems replaces linked closet items for a build (delete existing, insert new). Build must belong to device.
func (r *Repository) LinkItems(ctx context.Context, buildID, deviceID string, closetItemIDs []string) error {
	build, err := r.GetByID(ctx, buildID, deviceID)
	if err != nil {
		return err
	}
	if build == nil {
		return nil // not found, caller may treat as 404
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `DELETE FROM build_item_links WHERE build_id = $1`, buildID)
	if err != nil {
		return err
	}
	for _, cid := range closetItemIDs {
		_, err = tx.Exec(ctx, `INSERT INTO build_item_links (build_id, closet_item_id) VALUES ($1, $2)`, buildID, cid)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// GetLinkedClosetItemIDs returns closet item IDs linked to the build.
func (r *Repository) GetLinkedClosetItemIDs(ctx context.Context, buildID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT closet_item_id FROM build_item_links WHERE build_id = $1 ORDER BY closet_item_id`, buildID)
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

// ListTasks returns tasks for a build (caller must verify build belongs to device).
func (r *Repository) ListTasks(ctx context.Context, buildID string) ([]BuildTask, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at
		FROM build_tasks WHERE build_id = $1 ORDER BY sort_order ASC, created_at ASC
	`, buildID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []BuildTask
	for rows.Next() {
		var t BuildTask
		var closetID *string
		err := rows.Scan(&t.ID, &t.BuildID, &t.Label, &closetID, &t.SortOrder, &t.Checked, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}
		t.ClosetItemID = closetID
		list = append(list, t)
	}
	return list, rows.Err()
}

// CreateTask inserts a task for a build. Build must exist and belong to device. If in.ID is set, use it (offline sync).
func (r *Repository) CreateTask(ctx context.Context, buildID string, in CreateBuildTaskInput) (BuildTask, error) {
	id := in.ID
	if id == "" {
		id = uuid.New().String()
	}
	var t BuildTask
	var closetID *string
	err := r.pool.QueryRow(ctx, `
		INSERT INTO build_tasks (id, build_id, label, closet_item_id, sort_order)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at
	`, id, buildID, in.Label, in.ClosetItemID, in.SortOrder).Scan(
		&t.ID, &t.BuildID, &t.Label, &closetID, &t.SortOrder, &t.Checked, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return BuildTask{}, err
	}
	t.ClosetItemID = closetID
	return t, nil
}

// UpdateTask updates a task by id. Task must belong to build; caller verifies build ownership.
func (r *Repository) UpdateTask(ctx context.Context, taskID, buildID string, in UpdateBuildTaskInput) (*BuildTask, error) {
	// Fetch existing
	var t BuildTask
	var closetID *string
	err := r.pool.QueryRow(ctx, `
		SELECT id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at
		FROM build_tasks WHERE id = $1 AND build_id = $2
	`, taskID, buildID).Scan(&t.ID, &t.BuildID, &t.Label, &closetID, &t.SortOrder, &t.Checked, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.ClosetItemID = closetID
	if in.Label != nil {
		t.Label = *in.Label
	}
	if in.ClosetItemID != nil {
		t.ClosetItemID = in.ClosetItemID
	}
	if in.SortOrder != nil {
		t.SortOrder = *in.SortOrder
	}
	if in.Checked != nil {
		t.Checked = *in.Checked
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE build_tasks SET label = $2, closet_item_id = $3, sort_order = $4, checked = $5
		WHERE id = $1 AND build_id = $6
	`, taskID, t.Label, t.ClosetItemID, t.SortOrder, t.Checked, buildID)
	if err != nil {
		return nil, err
	}
	return r.getTaskByID(ctx, taskID, buildID)
}

func (r *Repository) getTaskByID(ctx context.Context, taskID, buildID string) (*BuildTask, error) {
	var t BuildTask
	var closetID *string
	err := r.pool.QueryRow(ctx, `
		SELECT id, build_id, label, closet_item_id, sort_order, checked, created_at, updated_at
		FROM build_tasks WHERE id = $1 AND build_id = $2
	`, taskID, buildID).Scan(&t.ID, &t.BuildID, &t.Label, &closetID, &t.SortOrder, &t.Checked, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.ClosetItemID = closetID
	return &t, nil
}

// DeleteTask removes a task by id and build_id.
func (r *Repository) DeleteTask(ctx context.Context, taskID, buildID string) (bool, error) {
	res, err := r.pool.Exec(ctx, `DELETE FROM build_tasks WHERE id = $1 AND build_id = $2`, taskID, buildID)
	if err != nil {
		return false, err
	}
	return res.RowsAffected() > 0, nil
}
