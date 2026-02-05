package seed

import (
	"context"
	"time"

	"kyarafit-backend/internal/builds"
	"kyarafit-backend/internal/convention"

	"github.com/google/uuid"
)

// CreateStarterData creates default build and convention for new device/user.
// Returns true if seed data was created, false if already exists.
func CreateStarterData(
	ctx context.Context,
	deviceID string,
	userID string,
	buildRepo *builds.Repository,
	conventionRepo *convention.Repository,
) (bool, error) {
	// Check if device already has data (skip if >0 builds exist)
	existingBuilds, err := buildRepo.ListByDevice(ctx, deviceID)
	if err != nil {
		return false, err
	}
	if len(existingBuilds) > 0 {
		return false, nil // Already has data
	}

	// Create "My First Build" with starter tasks
	buildID := uuid.New().String()
	imageURL := BuildPlaceholderImage
	build, err := buildRepo.Create(ctx, deviceID, userID, builds.CreateBuildInput{
		ID:       buildID,
		Name:     "My First Build",
		Status:   "idea",
		ImageURL: &imageURL,
		Notes:    strPtr("Welcome to Kyarafit! This is your first build. Tap to edit and make it your own."),
	})
	if err != nil {
		return false, err
	}

	// Create starter tasks for the build
	starterTasks := []string{
		"Research reference images",
		"Sketch design concept",
		"Source materials",
		"Create mockup",
	}
	for i, taskLabel := range starterTasks {
		_, taskErr := buildRepo.CreateTask(ctx, build.ID, builds.CreateBuildTaskInput{
			Label:     taskLabel,
			SortOrder: i,
		})
		if taskErr != nil {
			// Continue even if task creation fails
			continue
		}
	}

	// Create "My First Convention" with dates 3 months from today
	now := time.Now()
	startDate := now.AddDate(0, 3, 0)     // 3 months from now
	endDate := startDate.AddDate(0, 0, 2) // 3 days duration
	startDateStr := startDate.Format("2006-01-02")
	endDateStr := endDate.Format("2006-01-02")

	convImageURL := ConventionPlaceholderImage
	location := "TBD"
	_, err = conventionRepo.CreateConvention(ctx, deviceID, userID, convention.CreateConventionInput{
		ID:        uuid.New().String(),
		Name:      "My First Convention",
		Location:  &location,
		ImageURL:  &convImageURL,
		StartDate: startDateStr,
		EndDate:   endDateStr,
	})
	if err != nil {
		return false, err
	}

	return true, nil
}

func strPtr(s string) *string {
	return &s
}
