package closet

import "time"

// Item is a closet item (API shape). Category: wig | prop | armor | garment | shoe | material | other
type Item struct {
	ID        string   `json:"id"`
	DeviceID  string   `json:"-"` // not exposed in API
	Name      string   `json:"name"`
	Category  string   `json:"category"`
	Tags      []string `json:"tags"`
	Notes     *string  `json:"notes,omitempty"`
	ImageURL  *string  `json:"imageUrl,omitempty"`
	CostCents *int64   `json:"costCents,omitempty"`
	CreatedAt string   `json:"createdAt"` // ISO8601
	UpdatedAt string   `json:"updatedAt"` // ISO8601
}

// itemRow is used for DB scanning (timestamps as time.Time).
type itemRow struct {
	ID        string
	DeviceID  string
	Name      string
	Category  string
	Tags      []byte
	Notes     *string
	ImageURL  *string
	CostCents *int64
	CreatedAt time.Time
	UpdatedAt time.Time
}

// CreateInput is the payload for POST /closet/items
type CreateInput struct {
	Name      string   `json:"name"`
	Category  string   `json:"category"`
	Tags      []string `json:"tags"`
	Notes     *string  `json:"notes,omitempty"`
	ImageURL  *string  `json:"imageUrl,omitempty"`
	CostCents *int64   `json:"costCents,omitempty"`
}

// UpdateInput is the payload for PATCH /closet/items/:id
type UpdateInput struct {
	Name      *string  `json:"name,omitempty"`
	Category  *string  `json:"category,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Notes     *string  `json:"notes,omitempty"`
	ImageURL  *string  `json:"imageUrl,omitempty"`
	CostCents *int64   `json:"costCents,omitempty"`
}
