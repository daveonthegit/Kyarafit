package sync

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository handles sync operations
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new sync repository
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// PullResponse contains all changes since a given timestamp
type PullResponse struct {
	ClosetItems      []ClosetItemChange      `json:"closetItems"`
	Builds           []BuildChange           `json:"builds"`
	BuildTasks       []BuildTaskChange       `json:"buildTasks"`
	Conventions      []ConventionChange      `json:"conventions"`
	ConventionPlans  []ConventionPlanChange  `json:"conventionPlans"`
	PackingListItems []PackingListItemChange `json:"packingListItems"`
	ServerTimestamp  string                  `json:"serverTimestamp"`
}

// Change types for each entity
type ClosetItemChange struct {
	ID        string  `json:"id"`
	DeviceID  string  `json:"deviceId"`
	Name      string  `json:"name"`
	Category  *string `json:"category,omitempty"`
	ImageURL  *string `json:"imageUrl,omitempty"`
	Notes     *string `json:"notes,omitempty"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
	Deleted   bool    `json:"deleted"`
}

type BuildChange struct {
	ID          string  `json:"id"`
	DeviceID    string  `json:"deviceId"`
	Name        string  `json:"name"`
	Character   *string `json:"character,omitempty"`
	Status      string  `json:"status"`
	Notes       *string `json:"notes,omitempty"`
	ImageURL    *string `json:"imageUrl,omitempty"`
	BudgetCents *int    `json:"budgetCents,omitempty"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
	Deleted     bool    `json:"deleted"`
}

type BuildTaskChange struct {
	ID           string  `json:"id"`
	BuildID      string  `json:"buildId"`
	Label        string  `json:"label"`
	ClosetItemID *string `json:"closetItemId,omitempty"`
	SortOrder    int     `json:"sortOrder"`
	Checked      bool    `json:"checked"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
	Deleted      bool    `json:"deleted"`
}

type ConventionChange struct {
	ID        string  `json:"id"`
	DeviceID  string  `json:"deviceId"`
	Name      string  `json:"name"`
	Location  *string `json:"location,omitempty"`
	ImageURL  *string `json:"imageUrl,omitempty"`
	StartDate string  `json:"startDate"`
	EndDate   string  `json:"endDate"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
	Deleted   bool    `json:"deleted"`
}

type ConventionPlanChange struct {
	ID           string  `json:"id"`
	ConventionID string  `json:"conventionId"`
	Date         string  `json:"date"`
	BuildID      *string `json:"buildId,omitempty"`
	Notes        *string `json:"notes,omitempty"`
	Deleted      bool    `json:"deleted"`
}

type PackingListItemChange struct {
	ID           string  `json:"id"`
	ConventionID string  `json:"conventionId"`
	Date         *string `json:"date,omitempty"`
	BuildID      *string `json:"buildId,omitempty"`
	ClosetItemID *string `json:"closetItemId,omitempty"`
	Label        string  `json:"label"`
	Checked      bool    `json:"checked"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
	Deleted      bool    `json:"deleted"`
}

// Pull fetches all changes for a user since the given timestamp
func (r *Repository) Pull(ctx context.Context, userID string, since *time.Time) (*PullResponse, error) {
	resp := &PullResponse{
		ClosetItems:      []ClosetItemChange{},
		Builds:           []BuildChange{},
		BuildTasks:       []BuildTaskChange{},
		Conventions:      []ConventionChange{},
		ConventionPlans:  []ConventionPlanChange{},
		PackingListItems: []PackingListItemChange{},
		ServerTimestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	// Build WHERE clause for timestamp filtering
	whereClause := "user_id = $1"
	args := []interface{}{userID}
	if since != nil {
		whereClause += " AND updated_at > $2"
		args = append(args, *since)
	}

	// Fetch closet items
	rows, err := r.pool.Query(ctx, `
		SELECT id, device_id, name, category, image_url, notes, created_at, updated_at
		FROM closet_items
		WHERE `+whereClause+`
		ORDER BY updated_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item ClosetItemChange
		var category, imageURL, notes *string
		scanErr := rows.Scan(&item.ID, &item.DeviceID, &item.Name, &category, &imageURL, &notes, &item.CreatedAt, &item.UpdatedAt)
		if scanErr != nil {
			rows.Close()
			return nil, scanErr
		}
		item.Category = category
		item.ImageURL = imageURL
		item.Notes = notes
		item.Deleted = false
		resp.ClosetItems = append(resp.ClosetItems, item)
	}
	rows.Close()

	// Fetch builds
	rows, err = r.pool.Query(ctx, `
		SELECT id, device_id, name, character, status, notes, image_url, budget_cents, created_at, updated_at
		FROM device_builds
		WHERE `+whereClause+`
		ORDER BY updated_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var build BuildChange
		var character, notes, imageURL *string
		var budgetCents *int
		scanErr := rows.Scan(&build.ID, &build.DeviceID, &build.Name, &character, &build.Status, &notes, &imageURL, &budgetCents, &build.CreatedAt, &build.UpdatedAt)
		if scanErr != nil {
			rows.Close()
			return nil, scanErr
		}
		build.Character = character
		build.Notes = notes
		build.ImageURL = imageURL
		build.BudgetCents = budgetCents
		build.Deleted = false
		resp.Builds = append(resp.Builds, build)
	}
	rows.Close()

	// Fetch build tasks (join with builds to filter by user)
	taskArgs := args
	taskWhere := whereClause
	rows, err = r.pool.Query(ctx, `
		SELECT bt.id, bt.build_id, bt.label, bt.closet_item_id, bt.sort_order, bt.checked, bt.created_at, bt.updated_at
		FROM build_tasks bt
		JOIN device_builds db ON bt.build_id = db.id
		WHERE db.`+taskWhere+`
		ORDER BY bt.updated_at ASC
	`, taskArgs...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var task BuildTaskChange
		var closetItemID *string
		scanErr := rows.Scan(&task.ID, &task.BuildID, &task.Label, &closetItemID, &task.SortOrder, &task.Checked, &task.CreatedAt, &task.UpdatedAt)
		if scanErr != nil {
			rows.Close()
			return nil, scanErr
		}
		task.ClosetItemID = closetItemID
		task.Deleted = false
		resp.BuildTasks = append(resp.BuildTasks, task)
	}
	rows.Close()

	// Fetch conventions
	rows, err = r.pool.Query(ctx, `
		SELECT id, device_id, name, location, image_url, start_date, end_date, created_at, updated_at
		FROM conventions
		WHERE `+whereClause+`
		ORDER BY updated_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var conv ConventionChange
		var location, imageURL *string
		scanErr := rows.Scan(&conv.ID, &conv.DeviceID, &conv.Name, &location, &imageURL, &conv.StartDate, &conv.EndDate, &conv.CreatedAt, &conv.UpdatedAt)
		if scanErr != nil {
			rows.Close()
			return nil, scanErr
		}
		conv.Location = location
		conv.ImageURL = imageURL
		conv.Deleted = false
		resp.Conventions = append(resp.Conventions, conv)
	}
	rows.Close()

	// Fetch convention plans (join with conventions to filter by user)
	rows, err = r.pool.Query(ctx, `
		SELECT cdp.id, cdp.convention_id, cdp.date, cdp.build_id, cdp.notes
		FROM convention_day_plans cdp
		JOIN conventions c ON cdp.convention_id = c.id
		WHERE c.`+whereClause+`
		ORDER BY cdp.date ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var plan ConventionPlanChange
		var buildID, notes *string
		scanErr := rows.Scan(&plan.ID, &plan.ConventionID, &plan.Date, &buildID, &notes)
		if scanErr != nil {
			rows.Close()
			return nil, scanErr
		}
		plan.BuildID = buildID
		plan.Notes = notes
		plan.Deleted = false
		resp.ConventionPlans = append(resp.ConventionPlans, plan)
	}
	rows.Close()

	// Fetch packing list items (join with conventions to filter by user)
	rows, err = r.pool.Query(ctx, `
		SELECT pli.id, pli.convention_id, pli.date, pli.build_id, pli.closet_item_id, pli.label, pli.checked, pli.created_at, pli.updated_at
		FROM packing_list_items pli
		JOIN conventions c ON pli.convention_id = c.id
		WHERE c.`+whereClause+`
		ORDER BY pli.updated_at ASC
	`, args...)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item PackingListItemChange
		var date, buildID, closetItemID *string
		err := rows.Scan(&item.ID, &item.ConventionID, &date, &buildID, &closetItemID, &item.Label, &item.Checked, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			rows.Close()
			return nil, err
		}
		item.Date = date
		item.BuildID = buildID
		item.ClosetItemID = closetItemID
		item.Deleted = false
		resp.PackingListItems = append(resp.PackingListItems, item)
	}
	rows.Close()

	return resp, nil
}
