package models

import (
	"time"
	"github.com/google/uuid"
)

// BuildStatus represents the status of a build
type BuildStatus string

const (
	BuildStatusIdea      BuildStatus = "idea"
	BuildStatusSourcing  BuildStatus = "sourcing"
	BuildStatusWIP       BuildStatus = "wip"
	BuildStatusComplete  BuildStatus = "complete"
	BuildStatusOnHold    BuildStatus = "on_hold"
	BuildStatusCancelled BuildStatus = "cancelled"
)

// Build represents a cosplay build project
type Build struct {
	ID          uuid.UUID   `json:"id" db:"id"`
	UserID      uuid.UUID   `json:"user_id" db:"user_id"`
	Name        string      `json:"name" db:"name"`
	Description *string     `json:"description,omitempty" db:"description"`
	Character   *string     `json:"character,omitempty" db:"character"`
	Series      *string     `json:"series,omitempty" db:"series"`
	Status      BuildStatus `json:"status" db:"status"`
	Priority    *int        `json:"priority,omitempty" db:"priority"` // 1-5 scale
	Budget      *float64    `json:"budget,omitempty" db:"budget"`
	Spent       *float64    `json:"spent,omitempty" db:"spent"`
	StartDate   *time.Time  `json:"start_date,omitempty" db:"start_date"`
	TargetDate  *time.Time  `json:"target_date,omitempty" db:"target_date"`
	CompletedDate *time.Time `json:"completed_date,omitempty" db:"completed_date"`
	Tags        []string    `json:"tags,omitempty" db:"tags"`
	Notes       *string     `json:"notes,omitempty" db:"notes"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at" db:"updated_at"`
}

// CreateBuildRequest represents the request payload for creating a build
type CreateBuildRequest struct {
	Name        string      `json:"name" validate:"required,min=1,max=255"`
	Description *string     `json:"description,omitempty" validate:"omitempty,max=1000"`
	Character   *string     `json:"character,omitempty" validate:"omitempty,max=255"`
	Series      *string     `json:"series,omitempty" validate:"omitempty,max=255"`
	Status      *string     `json:"status,omitempty" validate:"omitempty,oneof=idea sourcing wip complete on_hold cancelled"`
	Priority    *int        `json:"priority,omitempty" validate:"omitempty,min=1,max=5"`
	Budget      *float64    `json:"budget,omitempty" validate:"omitempty,min=0"`
	Spent       *float64    `json:"spent,omitempty" validate:"omitempty,min=0"`
	StartDate   *string     `json:"start_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	TargetDate  *string     `json:"target_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Tags        []string    `json:"tags,omitempty"`
	Notes       *string     `json:"notes,omitempty" validate:"omitempty,max=2000"`
}

// UpdateBuildRequest represents the request payload for updating a build
type UpdateBuildRequest struct {
	Name        *string     `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	Description *string     `json:"description,omitempty" validate:"omitempty,max=1000"`
	Character   *string     `json:"character,omitempty" validate:"omitempty,max=255"`
	Series      *string     `json:"series,omitempty" validate:"omitempty,max=255"`
	Status      *string     `json:"status,omitempty" validate:"omitempty,oneof=idea sourcing wip complete on_hold cancelled"`
	Priority    *int        `json:"priority,omitempty" validate:"omitempty,min=1,max=5"`
	Budget      *float64    `json:"budget,omitempty" validate:"omitempty,min=0"`
	Spent       *float64    `json:"spent,omitempty" validate:"omitempty,min=0"`
	StartDate   *string     `json:"start_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	TargetDate  *string     `json:"target_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	CompletedDate *string   `json:"completed_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Tags        []string    `json:"tags,omitempty"`
	Notes       *string     `json:"notes,omitempty" validate:"omitempty,max=2000"`
}

// BuildResponse represents the response format for build data
type BuildResponse struct {
	ID            uuid.UUID   `json:"id"`
	UserID        uuid.UUID   `json:"user_id"`
	Name          string      `json:"name"`
	Description   *string     `json:"description,omitempty"`
	Character     *string     `json:"character,omitempty"`
	Series        *string     `json:"series,omitempty"`
	Status        BuildStatus `json:"status"`
	Priority      *int        `json:"priority,omitempty"`
	Budget        *float64    `json:"budget,omitempty"`
	Spent         *float64    `json:"spent,omitempty"`
	StartDate     *time.Time  `json:"start_date,omitempty"`
	TargetDate    *time.Time  `json:"target_date,omitempty"`
	CompletedDate *time.Time  `json:"completed_date,omitempty"`
	Tags          []string    `json:"tags,omitempty"`
	Notes         *string     `json:"notes,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

// ToResponse converts a Build model to BuildResponse
func (b *Build) ToResponse() BuildResponse {
	return BuildResponse{
		ID:            b.ID,
		UserID:        b.UserID,
		Name:          b.Name,
		Description:   b.Description,
		Character:     b.Character,
		Series:        b.Series,
		Status:        b.Status,
		Priority:      b.Priority,
		Budget:        b.Budget,
		Spent:         b.Spent,
		StartDate:     b.StartDate,
		TargetDate:    b.TargetDate,
		CompletedDate: b.CompletedDate,
		Tags:          b.Tags,
		Notes:         b.Notes,
		CreatedAt:     b.CreatedAt,
		UpdatedAt:     b.UpdatedAt,
	}
}

// GetStatusDisplayName returns a human-readable status name
func (s BuildStatus) GetStatusDisplayName() string {
	switch s {
	case BuildStatusIdea:
		return "Idea"
	case BuildStatusSourcing:
		return "Sourcing"
	case BuildStatusWIP:
		return "Work in Progress"
	case BuildStatusComplete:
		return "Complete"
	case BuildStatusOnHold:
		return "On Hold"
	case BuildStatusCancelled:
		return "Cancelled"
	default:
		return "Unknown"
	}
}

// IsValidStatus checks if a status string is valid
func IsValidStatus(status string) bool {
	switch BuildStatus(status) {
	case BuildStatusIdea, BuildStatusSourcing, BuildStatusWIP, BuildStatusComplete, BuildStatusOnHold, BuildStatusCancelled:
		return true
	default:
		return false
	}
}
