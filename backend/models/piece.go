package models

import (
	"time"
	"github.com/google/uuid"
)

// Piece represents a costume piece, wig, prop, or accessory
type Piece struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	UserID           uuid.UUID  `json:"user_id" db:"user_id"`
	Name             string     `json:"name" db:"name"`
	Description      *string    `json:"description,omitempty" db:"description"`
	ImageURL         *string    `json:"image_url,omitempty" db:"image_url"`
	ThumbnailURL     *string    `json:"thumbnail_url,omitempty" db:"thumbnail_url"`
	Category         *string    `json:"category,omitempty" db:"category"`
	Tags             []string   `json:"tags,omitempty" db:"tags"`
	SourceLink       *string    `json:"source_link,omitempty" db:"source_link"`
	PurchaseDate     *time.Time `json:"purchase_date,omitempty" db:"purchase_date"`
	Price            *float64   `json:"price,omitempty" db:"price"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// CreatePieceRequest represents the request payload for creating a piece
type CreatePieceRequest struct {
	Name         string    `json:"name" validate:"required,min=1,max=255"`
	Description  *string   `json:"description,omitempty" validate:"omitempty,max=1000"`
	ImageURL     *string   `json:"image_url,omitempty" validate:"omitempty,url"`
	ThumbnailURL *string   `json:"thumbnail_url,omitempty" validate:"omitempty,url"`
	Category     *string   `json:"category,omitempty" validate:"omitempty,max=100"`
	Tags         []string  `json:"tags,omitempty"`
	SourceLink   *string   `json:"source_link,omitempty" validate:"omitempty,url"`
	PurchaseDate *string   `json:"purchase_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Price        *float64  `json:"price,omitempty" validate:"omitempty,min=0"`
}

// UpdatePieceRequest represents the request payload for updating a piece
type UpdatePieceRequest struct {
	Name         *string   `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	Description  *string   `json:"description,omitempty" validate:"omitempty,max=1000"`
	ImageURL     *string   `json:"image_url,omitempty" validate:"omitempty,url"`
	ThumbnailURL *string   `json:"thumbnail_url,omitempty" validate:"omitempty,url"`
	Category     *string   `json:"category,omitempty" validate:"omitempty,max=100"`
	Tags         []string  `json:"tags,omitempty"`
	SourceLink   *string   `json:"source_link,omitempty" validate:"omitempty,url"`
	PurchaseDate *string   `json:"purchase_date,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Price        *float64  `json:"price,omitempty" validate:"omitempty,min=0"`
}

// PieceResponse represents the response format for piece data
type PieceResponse struct {
	ID           uuid.UUID  `json:"id"`
	UserID       uuid.UUID  `json:"user_id"`
	Name         string     `json:"name"`
	Description  *string    `json:"description,omitempty"`
	ImageURL     *string    `json:"image_url,omitempty"`
	ThumbnailURL *string    `json:"thumbnail_url,omitempty"`
	Category     *string    `json:"category,omitempty"`
	Tags         []string   `json:"tags,omitempty"`
	SourceLink   *string    `json:"source_link,omitempty"`
	PurchaseDate *time.Time `json:"purchase_date,omitempty"`
	Price        *float64   `json:"price,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// ToResponse converts a Piece model to PieceResponse
func (p *Piece) ToResponse() PieceResponse {
	return PieceResponse{
		ID:           p.ID,
		UserID:       p.UserID,
		Name:         p.Name,
		Description:  p.Description,
		ImageURL:     p.ImageURL,
		ThumbnailURL: p.ThumbnailURL,
		Category:     p.Category,
		Tags:         p.Tags,
		SourceLink:   p.SourceLink,
		PurchaseDate: p.PurchaseDate,
		Price:        p.Price,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
}
