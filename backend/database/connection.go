package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool
var SQLDB *sql.DB // Keep for migrations

// Connect establishes a connection to the PostgreSQL database
func Connect() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable is required")
	}

	// Create pgxpool for main operations
	var err error
	ctx := context.Background()
	DB, err = pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("failed to create pgxpool: %w", err)
	}

	// Test the connection
	if err = DB.Ping(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Create sql.DB for migrations
	SQLDB, err = sql.Open("postgres", databaseURL)
	if err != nil {
		return fmt.Errorf("failed to open sql database connection: %w", err)
	}

	// Test the sql connection
	if err = SQLDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping sql database: %w", err)
	}

	log.Println("Successfully connected to database")
	return nil
}

// RunMigrations runs database migrations
func RunMigrations() error {
	if SQLDB == nil {
		return fmt.Errorf("database connection not established")
	}

	driver, err := postgres.WithInstance(SQLDB, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://migrations",
		"postgres",
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Println("Database migrations completed successfully")
	return nil
}

// Close closes the database connection
func Close() error {
	var err error
	if DB != nil {
		DB.Close()
	}
	if SQLDB != nil {
		err = SQLDB.Close()
	}
	return err
}

