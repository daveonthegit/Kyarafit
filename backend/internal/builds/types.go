package builds

import "time"

// Build is a device-scoped cosplay build.
type Build struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Character   *string   `json:"character,omitempty"`
	Status      string    `json:"status"` // idea | wip | ready
	Notes       *string   `json:"notes,omitempty"`
	ImageURL    *string   `json:"imageUrl,omitempty"`
	BudgetCents *int64    `json:"budgetCents,omitempty"`
	CreatedAt   time.Time `json:"createdAt"` // RFC3339
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateBuildInput is the payload for POST /builds.
// Id is optional; when provided (e.g. from offline sync) the server uses it.
type CreateBuildInput struct {
	ID          string  `json:"id,omitempty"`
	Name        string  `json:"name"`
	Character   *string `json:"character,omitempty"`
	Status      string  `json:"status"` // default idea
	Notes       *string `json:"notes,omitempty"`
	ImageURL    *string `json:"imageUrl,omitempty"`
	BudgetCents *int64  `json:"budgetCents,omitempty"`
}

// UpdateBuildInput is the payload for PATCH /builds/:id.
type UpdateBuildInput struct {
	Name        *string `json:"name,omitempty"`
	Character   *string `json:"character,omitempty"`
	Status      *string `json:"status,omitempty"`
	Notes       *string `json:"notes,omitempty"`
	ImageURL    *string `json:"imageUrl,omitempty"`
	BudgetCents *int64  `json:"budgetCents,omitempty"`
}

// LinkItemsInput is the payload for POST /builds/:id/items.
type LinkItemsInput struct {
	ClosetItemIDs []string `json:"closetItemIds"`
}

// BuildTask is a checklist item for a build; can link to a closet item.
type BuildTask struct {
	ID           string    `json:"id"`
	BuildID      string    `json:"buildId"`
	Label        string    `json:"label"`
	ClosetItemID *string   `json:"closetItemId,omitempty"`
	SortOrder    int       `json:"sortOrder"`
	Checked      bool      `json:"checked"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// CreateBuildTaskInput is the payload for POST /builds/:id/tasks. ID optional for offline sync.
type CreateBuildTaskInput struct {
	ID           string  `json:"id,omitempty"`
	Label        string  `json:"label"`
	ClosetItemID *string `json:"closetItemId,omitempty"`
	SortOrder    int     `json:"sortOrder"`
}

// UpdateBuildTaskInput is the payload for PATCH /builds/:id/tasks/:taskId.
type UpdateBuildTaskInput struct {
	Label        *string `json:"label,omitempty"`
	ClosetItemID *string `json:"closetItemId,omitempty"`
	SortOrder    *int    `json:"sortOrder,omitempty"`
	Checked      *bool   `json:"checked,omitempty"`
}
