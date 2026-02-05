package convention

import "time"

// Convention is a device-scoped convention.
type Convention struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Location  *string   `json:"location,omitempty"`
	StartDate string    `json:"startDate"` // YYYY-MM-DD
	EndDate   string    `json:"endDate"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateConventionInput for POST /conventions.
// ID is optional; when provided (e.g. from offline sync) the server uses it.
type CreateConventionInput struct {
	ID        string  `json:"id,omitempty"`
	Name      string  `json:"name"`
	Location  *string `json:"location,omitempty"`
	StartDate string  `json:"startDate"`
	EndDate   string  `json:"endDate"`
}

// UpdateConventionInput for PATCH /conventions/:id.
type UpdateConventionInput struct {
	Name      *string `json:"name,omitempty"`
	Location  *string `json:"location,omitempty"`
	StartDate *string `json:"startDate,omitempty"`
	EndDate   *string `json:"endDate,omitempty"`
}

// DayPlanEntry is one day in the plan (date + optional build + notes).
type DayPlanEntry struct {
	Date    string  `json:"date"` // YYYY-MM-DD
	BuildID *string `json:"buildId,omitempty"`
	Notes   *string `json:"notes,omitempty"`
}

// ReplacePlanInput for PUT /conventions/:id/plan.
type ReplacePlanInput struct {
	Plan []DayPlanEntry `json:"plan"`
}

// ConventionDayPlan row from DB.
type ConventionDayPlan struct {
	ID           string  `json:"id"`
	ConventionID string  `json:"conventionId"`
	Date         string  `json:"date"`
	BuildID      *string `json:"buildId,omitempty"`
	Notes        *string `json:"notes,omitempty"`
}

// PackingListItem row.
type PackingListItem struct {
	ID           string    `json:"id"`
	ConventionID string    `json:"conventionId"`
	Date         *string   `json:"date,omitempty"`
	BuildID      *string   `json:"buildId,omitempty"`
	ClosetItemID *string   `json:"closetItemId,omitempty"`
	Label        string    `json:"label"`
	Checked      bool      `json:"checked"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// AddManualPackingInput for POST /conventions/:id/packing/manual.
type AddManualPackingInput struct {
	Label   string  `json:"label"`
	Date    *string `json:"date,omitempty"`
	BuildID *string `json:"buildId,omitempty"`
}

// UpdatePackingInput for PATCH /packing/:id.
type UpdatePackingInput struct {
	Checked *bool   `json:"checked,omitempty"`
	Label   *string `json:"label,omitempty"`
}
