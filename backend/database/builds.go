package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"kyarafit-backend/models"
)

type BuildRepository struct {
	db *pgxpool.Pool
}

func NewBuildRepository(db *pgxpool.Pool) *BuildRepository {
	return &BuildRepository{db: db}
}

// CreateBuild creates a new build in the database
func (r *BuildRepository) CreateBuild(build *models.Build) error {
	ctx := context.Background()
	query := `
		INSERT INTO builds (id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(
		ctx,
		query,
		build.ID,
		build.UserID,
		build.Name,
		build.Description,
		build.Character,
		build.Series,
		build.Status,
		build.Priority,
		build.Budget,
		build.Spent,
		build.StartDate,
		build.TargetDate,
		build.CompletedDate,
		build.Tags,
		build.Notes,
		build.CreatedAt,
		build.UpdatedAt,
	).Scan(&build.ID, &build.CreatedAt, &build.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create build: %w", err)
	}

	return nil
}

// GetBuildByID retrieves a build by its ID
func (r *BuildRepository) GetBuildByID(id uuid.UUID) (*models.Build, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at
		FROM builds
		WHERE id = $1`

	build := &models.Build{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&build.ID,
		&build.UserID,
		&build.Name,
		&build.Description,
		&build.Character,
		&build.Series,
		&build.Status,
		&build.Priority,
		&build.Budget,
		&build.Spent,
		&build.StartDate,
		&build.TargetDate,
		&build.CompletedDate,
		&build.Tags,
		&build.Notes,
		&build.CreatedAt,
		&build.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("build not found")
		}
		return nil, fmt.Errorf("failed to get build: %w", err)
	}

	return build, nil
}

// GetBuildsByUserID retrieves all builds for a specific user
func (r *BuildRepository) GetBuildsByUserID(userID uuid.UUID, limit, offset int) ([]*models.Build, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at
		FROM builds
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get builds: %w", err)
	}
	defer rows.Close()

	var builds []*models.Build
	for rows.Next() {
		build := &models.Build{}
		err := rows.Scan(
			&build.ID,
			&build.UserID,
			&build.Name,
			&build.Description,
			&build.Character,
			&build.Series,
			&build.Status,
			&build.Priority,
			&build.Budget,
			&build.Spent,
			&build.StartDate,
			&build.TargetDate,
			&build.CompletedDate,
			&build.Tags,
			&build.Notes,
			&build.CreatedAt,
			&build.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan build: %w", err)
		}
		builds = append(builds, build)
	}

	return builds, nil
}

// GetBuildsByStatus retrieves builds by status for a specific user
func (r *BuildRepository) GetBuildsByStatus(userID uuid.UUID, status models.BuildStatus, limit, offset int) ([]*models.Build, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at
		FROM builds
		WHERE user_id = $1 AND status = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := r.db.Query(ctx, query, userID, status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get builds by status: %w", err)
	}
	defer rows.Close()

	var builds []*models.Build
	for rows.Next() {
		build := &models.Build{}
		err := rows.Scan(
			&build.ID,
			&build.UserID,
			&build.Name,
			&build.Description,
			&build.Character,
			&build.Series,
			&build.Status,
			&build.Priority,
			&build.Budget,
			&build.Spent,
			&build.StartDate,
			&build.TargetDate,
			&build.CompletedDate,
			&build.Tags,
			&build.Notes,
			&build.CreatedAt,
			&build.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan build: %w", err)
		}
		builds = append(builds, build)
	}

	return builds, nil
}

// UpdateBuild updates an existing build
func (r *BuildRepository) UpdateBuild(build *models.Build) error {
	ctx := context.Background()
	query := `
		UPDATE builds
		SET name = $2, description = $3, character = $4, series = $5, status = $6, priority = $7, budget = $8, spent = $9, start_date = $10, target_date = $11, completed_date = $12, tags = $13, notes = $14, updated_at = $15
		WHERE id = $1 AND user_id = $16
		RETURNING updated_at`

	err := r.db.QueryRow(
		ctx,
		query,
		build.ID,
		build.Name,
		build.Description,
		build.Character,
		build.Series,
		build.Status,
		build.Priority,
		build.Budget,
		build.Spent,
		build.StartDate,
		build.TargetDate,
		build.CompletedDate,
		build.Tags,
		build.Notes,
		build.UpdatedAt,
		build.UserID,
	).Scan(&build.UpdatedAt)

	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("build not found or access denied")
		}
		return fmt.Errorf("failed to update build: %w", err)
	}

	return nil
}

// DeleteBuild deletes a build by ID
func (r *BuildRepository) DeleteBuild(id uuid.UUID, userID uuid.UUID) error {
	ctx := context.Background()
	query := `DELETE FROM builds WHERE id = $1 AND user_id = $2`

	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete build: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("build not found or access denied")
	}

	return nil
}

// SearchBuilds searches builds by name, description, character, or series
func (r *BuildRepository) SearchBuilds(userID uuid.UUID, searchTerm string, limit, offset int) ([]*models.Build, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at
		FROM builds
		WHERE user_id = $1 AND (
			name ILIKE $2 OR 
			description ILIKE $2 OR 
			character ILIKE $2 OR
			series ILIKE $2 OR
			$2 = ANY(tags)
		)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	searchPattern := "%" + searchTerm + "%"
	rows, err := r.db.Query(ctx, query, userID, searchPattern, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search builds: %w", err)
	}
	defer rows.Close()

	var builds []*models.Build
	for rows.Next() {
		build := &models.Build{}
		err := rows.Scan(
			&build.ID,
			&build.UserID,
			&build.Name,
			&build.Description,
			&build.Character,
			&build.Series,
			&build.Status,
			&build.Priority,
			&build.Budget,
			&build.Spent,
			&build.StartDate,
			&build.TargetDate,
			&build.CompletedDate,
			&build.Tags,
			&build.Notes,
			&build.CreatedAt,
			&build.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan build: %w", err)
		}
		builds = append(builds, build)
	}

	return builds, nil
}

// GetBuildCount returns the total count of builds for a user
func (r *BuildRepository) GetBuildCount(userID uuid.UUID) (int, error) {
	ctx := context.Background()
	query := `SELECT COUNT(*) FROM builds WHERE user_id = $1`

	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get build count: %w", err)
	}

	return count, nil
}

// GetBuildsByPriority retrieves builds by priority for a specific user
func (r *BuildRepository) GetBuildsByPriority(userID uuid.UUID, priority int, limit, offset int) ([]*models.Build, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at
		FROM builds
		WHERE user_id = $1 AND priority = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`

	rows, err := r.db.Query(ctx, query, userID, priority, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get builds by priority: %w", err)
	}
	defer rows.Close()

	var builds []*models.Build
	for rows.Next() {
		build := &models.Build{}
		err := rows.Scan(
			&build.ID,
			&build.UserID,
			&build.Name,
			&build.Description,
			&build.Character,
			&build.Series,
			&build.Status,
			&build.Priority,
			&build.Budget,
			&build.Spent,
			&build.StartDate,
			&build.TargetDate,
			&build.CompletedDate,
			&build.Tags,
			&build.Notes,
			&build.CreatedAt,
			&build.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan build: %w", err)
		}
		builds = append(builds, build)
	}

	return builds, nil
}

// GetUpcomingBuilds retrieves builds with target dates approaching
func (r *BuildRepository) GetUpcomingBuilds(userID uuid.UUID, days int, limit, offset int) ([]*models.Build, error) {
	ctx := context.Background()
	query := `
		SELECT id, user_id, name, description, character, series, status, priority, budget, spent, start_date, target_date, completed_date, tags, notes, created_at, updated_at
		FROM builds
		WHERE user_id = $1 AND target_date IS NOT NULL AND target_date <= NOW() + INTERVAL '%d days' AND status != 'complete' AND status != 'cancelled'
		ORDER BY target_date ASC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, fmt.Sprintf(query, days), userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get upcoming builds: %w", err)
	}
	defer rows.Close()

	var builds []*models.Build
	for rows.Next() {
		build := &models.Build{}
		err := rows.Scan(
			&build.ID,
			&build.UserID,
			&build.Name,
			&build.Description,
			&build.Character,
			&build.Series,
			&build.Status,
			&build.Priority,
			&build.Budget,
			&build.Spent,
			&build.StartDate,
			&build.TargetDate,
			&build.CompletedDate,
			&build.Tags,
			&build.Notes,
			&build.CreatedAt,
			&build.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan build: %w", err)
		}
		builds = append(builds, build)
	}

	return builds, nil
}
