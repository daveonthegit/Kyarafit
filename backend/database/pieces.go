package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"kyarafit-backend/models"
)

type PieceRepository struct {
	db *pgxpool.Pool
}

func NewPieceRepository(db *pgxpool.Pool) *PieceRepository {
	return &PieceRepository{db: db}
}

// CreatePiece creates a new piece in the database
func (r *PieceRepository) CreatePiece(piece *models.Piece) error {
	ctx := context.Background()
	query := `
		INSERT INTO pieces (id, user_id, name, description, image_url, thumbnail_url, category, tags, source_link, purchase_date, price, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(
		ctx,
		query,
		piece.ID,
		piece.UserID,
		piece.Name,
		piece.Description,
		piece.ImageURL,
		piece.ThumbnailURL,
		piece.Category,
		piece.Tags,
		piece.SourceLink,
		piece.PurchaseDate,
		piece.Price,
		piece.CreatedAt,
		piece.UpdatedAt,
	).Scan(&piece.ID, &piece.CreatedAt, &piece.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create piece: %w", err)
	}

	return nil
}

// GetPieceByID retrieves a piece by its ID
func (r *PieceRepository) GetPieceByID(id uuid.UUID) (*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, image_url, thumbnail_url, category, tags, source_link, purchase_date, price, created_at, updated_at
		FROM pieces
		WHERE id = $1`

	piece := &models.Piece{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&piece.ID,
		&piece.UserID,
		&piece.Name,
		&piece.Description,
		&piece.ImageURL,
		&piece.ThumbnailURL,
		&piece.Category,
		&piece.Tags,
		&piece.SourceLink,
		&piece.PurchaseDate,
		&piece.Price,
		&piece.CreatedAt,
		&piece.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("piece not found")
		}
		return nil, fmt.Errorf("failed to get piece: %w", err)
	}

	return piece, nil
}

// GetPiecesByUserID retrieves all pieces for a specific user
func (r *PieceRepository) GetPiecesByUserID(userID uuid.UUID, limit, offset int) ([]*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, image_url, thumbnail_url, category, tags, source_link, purchase_date, price, created_at, updated_at
		FROM pieces
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get pieces: %w", err)
	}
	defer rows.Close()

	var pieces []*models.Piece
	for rows.Next() {
		piece := &models.Piece{}
		err := rows.Scan(
			&piece.ID,
			&piece.UserID,
			&piece.Name,
			&piece.Description,
			&piece.ImageURL,
			&piece.ThumbnailURL,
			&piece.Category,
			&piece.Tags,
			&piece.SourceLink,
			&piece.PurchaseDate,
			&piece.Price,
			&piece.CreatedAt,
			&piece.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan piece: %w", err)
		}
		pieces = append(pieces, piece)
	}

	return pieces, nil
}

// GetPiecesByCategory retrieves pieces by category for a specific user
func (r *PieceRepository) GetPiecesByCategory(userID uuid.UUID, category string, limit, offset int) ([]*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, image_url, thumbnail_url, category, tags, source_link, purchase_date, price, created_at, updated_at
		FROM pieces
		WHERE user_id = $1 AND category = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := r.db.Query(ctx, query, userID, category, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get pieces by category: %w", err)
	}
	defer rows.Close()

	var pieces []*models.Piece
	for rows.Next() {
		piece := &models.Piece{}
		err := rows.Scan(
			&piece.ID,
			&piece.UserID,
			&piece.Name,
			&piece.Description,
			&piece.ImageURL,
			&piece.ThumbnailURL,
			&piece.Category,
			&piece.Tags,
			&piece.SourceLink,
			&piece.PurchaseDate,
			&piece.Price,
			&piece.CreatedAt,
			&piece.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan piece: %w", err)
		}
		pieces = append(pieces, piece)
	}

	return pieces, nil
}

// UpdatePiece updates an existing piece
func (r *PieceRepository) UpdatePiece(piece *models.Piece) error {
	ctx := context.Background()
	query := `
		UPDATE pieces
		SET name = $2, description = $3, image_url = $4, thumbnail_url = $5, category = $6, tags = $7, source_link = $8, purchase_date = $9, price = $10, updated_at = $11
		WHERE id = $1 AND user_id = $12
		RETURNING updated_at`

	err := r.db.QueryRow(
		ctx,
		query,
		piece.ID,
		piece.Name,
		piece.Description,
		piece.ImageURL,
		piece.ThumbnailURL,
		piece.Category,
		piece.Tags,
		piece.SourceLink,
		piece.PurchaseDate,
		piece.Price,
		piece.UpdatedAt,
		piece.UserID,
	).Scan(&piece.UpdatedAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("piece not found or access denied")
		}
		return fmt.Errorf("failed to update piece: %w", err)
	}

	return nil
}

// DeletePiece deletes a piece by ID
func (r *PieceRepository) DeletePiece(id uuid.UUID, userID uuid.UUID) error {
	ctx := context.Background()
	query := `DELETE FROM pieces WHERE id = $1 AND user_id = $2`

	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete piece: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("piece not found or access denied")
	}

	return nil
}

// SearchPieces searches pieces by name, description, or tags
func (r *PieceRepository) SearchPieces(userID uuid.UUID, searchTerm string, limit, offset int) ([]*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, image_url, thumbnail_url, category, tags, source_link, purchase_date, price, created_at, updated_at
		FROM pieces
		WHERE user_id = $1 AND (
			name ILIKE $2 OR 
			description ILIKE $2 OR 
			category ILIKE $2 OR
			$2 = ANY(tags)
		)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	searchPattern := "%" + searchTerm + "%"
	rows, err := r.db.Query(ctx, query, userID, searchPattern, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search pieces: %w", err)
	}
	defer rows.Close()

	var pieces []*models.Piece
	for rows.Next() {
		piece := &models.Piece{}
		err := rows.Scan(
			&piece.ID,
			&piece.UserID,
			&piece.Name,
			&piece.Description,
			&piece.ImageURL,
			&piece.ThumbnailURL,
			&piece.Category,
			&piece.Tags,
			&piece.SourceLink,
			&piece.PurchaseDate,
			&piece.Price,
			&piece.CreatedAt,
			&piece.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan piece: %w", err)
		}
		pieces = append(pieces, piece)
	}

	return pieces, nil
}

// GetPieceCount returns the total count of pieces for a user
func (r *PieceRepository) GetPieceCount(userID uuid.UUID) (int, error) {
	ctx := context.Background()
	query := `SELECT COUNT(*) FROM pieces WHERE user_id = $1`

	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get piece count: %w", err)
	}

	return count, nil
}
