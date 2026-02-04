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

func (r *PieceRepository) CreatePiece(piece *models.Piece) error {
	ctx := context.Background()
	query := `
		INSERT INTO pieces (id, user_id, name, category, notes, image_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.Exec(ctx, query,
		piece.ID, piece.UserID, piece.Name, piece.Category, piece.Description, piece.ImageURL,
		piece.CreatedAt, piece.UpdatedAt,
	)
	return err
}

func (r *PieceRepository) GetPieceByID(id uuid.UUID) (*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, category, notes, image_url, created_at, updated_at
		FROM pieces WHERE id = $1`
	piece := &models.Piece{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&piece.ID, &piece.UserID, &piece.Name, &piece.Category, &piece.Description,
		&piece.ImageURL, &piece.CreatedAt, &piece.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("piece not found")
		}
		return nil, err
	}
	return piece, nil
}

func (r *PieceRepository) GetPiecesByUserID(userID uuid.UUID, limit, offset int) ([]*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, category, notes, image_url, created_at, updated_at
		FROM pieces WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pieces []*models.Piece
	for rows.Next() {
		p := &models.Piece{}
		err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Category, &p.Description, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		pieces = append(pieces, p)
	}
	return pieces, rows.Err()
}

func (r *PieceRepository) GetPiecesByCategory(userID uuid.UUID, category string, limit, offset int) ([]*models.Piece, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, category, notes, image_url, created_at, updated_at
		FROM pieces WHERE user_id = $1 AND category = $2 ORDER BY updated_at DESC LIMIT $3 OFFSET $4`
	rows, err := r.db.Query(ctx, query, userID, category, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pieces []*models.Piece
	for rows.Next() {
		p := &models.Piece{}
		err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Category, &p.Description, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		pieces = append(pieces, p)
	}
	return pieces, rows.Err()
}

func (r *PieceRepository) SearchPieces(userID uuid.UUID, search string, limit, offset int) ([]*models.Piece, error) {
	ctx := context.Background()
	pattern := "%" + search + "%"
	query := `
		SELECT id, user_id, name, category, notes, image_url, created_at, updated_at
		FROM pieces WHERE user_id = $1 AND (name ILIKE $2 OR notes ILIKE $2) ORDER BY updated_at DESC LIMIT $3 OFFSET $4`
	rows, err := r.db.Query(ctx, query, userID, pattern, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pieces []*models.Piece
	for rows.Next() {
		p := &models.Piece{}
		err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Category, &p.Description, &p.ImageURL, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		pieces = append(pieces, p)
	}
	return pieces, rows.Err()
}

func (r *PieceRepository) GetPieceCount(userID uuid.UUID) (int, error) {
	ctx := context.Background()
	var n int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM pieces WHERE user_id = $1`, userID).Scan(&n)
	return n, err
}

func (r *PieceRepository) UpdatePiece(piece *models.Piece) error {
	ctx := context.Background()
	query := `
		UPDATE pieces SET name = $2, category = $3, notes = $4, image_url = $5, updated_at = $6
		WHERE id = $1 AND user_id = $7`
	_, err := r.db.Exec(ctx, query, piece.ID, piece.Name, piece.Category, piece.Description, piece.ImageURL, piece.UpdatedAt, piece.UserID)
	return err
}

func (r *PieceRepository) DeletePiece(id, userID uuid.UUID) error {
	ctx := context.Background()
	res, err := r.db.Exec(ctx, `DELETE FROM pieces WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("piece not found or access denied")
	}
	return nil
}
