package handlers

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"kyarafit-backend/database"
	"kyarafit-backend/models"
)

type BuildsHandler struct {
	buildRepo *database.BuildRepository
}

func NewBuildsHandler(buildRepo *database.BuildRepository) *BuildsHandler {
	return &BuildsHandler{buildRepo: buildRepo}
}

// CreateBuild creates a new build
func (h *BuildsHandler) CreateBuild(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	var req models.CreateBuildRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Name is required",
		})
	}

	// Set default status if not provided
	status := models.BuildStatusIdea
	if req.Status != nil {
		if !models.IsValidStatus(*req.Status) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid status. Must be one of: idea, sourcing, wip, complete, on_hold, cancelled",
			})
		}
		status = models.BuildStatus(*req.Status)
	}

	// Parse dates if provided
	var startDate, targetDate *time.Time
	if req.StartDate != nil && *req.StartDate != "" {
		parsedDate, err := time.Parse("2006-01-02", *req.StartDate)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid start date format. Use YYYY-MM-DD",
			})
		}
		startDate = &parsedDate
	}

	if req.TargetDate != nil && *req.TargetDate != "" {
		parsedDate, err := time.Parse("2006-01-02", *req.TargetDate)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid target date format. Use YYYY-MM-DD",
			})
		}
		targetDate = &parsedDate
	}

	build := &models.Build{
		ID:          uuid.New(),
		UserID:      userUUID,
		Name:        req.Name,
		Description: req.Description,
		Character:   req.Character,
		Series:      req.Series,
		Status:      status,
		Priority:    req.Priority,
		Budget:      req.Budget,
		Spent:       req.Spent,
		StartDate:   startDate,
		TargetDate:  targetDate,
		Tags:        req.Tags,
		Notes:       req.Notes,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.buildRepo.CreateBuild(build); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create build",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Build created successfully",
		"build":   build.ToResponse(),
	})
}

// GetBuilds retrieves all builds for the authenticated user
func (h *BuildsHandler) GetBuilds(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	// Parse query parameters
	limit := 20
	offset := 0
	status := c.Query("status")
	priority := c.Query("priority")
	search := c.Query("search")
	upcoming := c.Query("upcoming")

	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	if offsetStr := c.Query("offset"); offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	var builds []*models.Build
	var buildsErr error

	if search != "" {
		builds, buildsErr = h.buildRepo.SearchBuilds(userUUID, search, limit, offset)
	} else if status != "" {
		if !models.IsValidStatus(status) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid status. Must be one of: idea, sourcing, wip, complete, on_hold, cancelled",
			})
		}
		builds, buildsErr = h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatus(status), limit, offset)
	} else if priority != "" {
		if parsedPriority, err := strconv.Atoi(priority); err == nil && parsedPriority >= 1 && parsedPriority <= 5 {
			builds, buildsErr = h.buildRepo.GetBuildsByPriority(userUUID, parsedPriority, limit, offset)
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid priority. Must be between 1 and 5",
			})
		}
	} else if upcoming != "" {
		days := 30 // Default to 30 days
		if parsedDays, err := strconv.Atoi(upcoming); err == nil && parsedDays > 0 {
			days = parsedDays
		}
		builds, buildsErr = h.buildRepo.GetUpcomingBuilds(userUUID, days, limit, offset)
	} else {
		builds, buildsErr = h.buildRepo.GetBuildsByUserID(userUUID, limit, offset)
	}

	if buildsErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve builds",
		})
	}

	// Convert to response format
	var response []models.BuildResponse
	for _, build := range builds {
		response = append(response, build.ToResponse())
	}

	// Get total count for pagination
	totalCount, err := h.buildRepo.GetBuildCount(userUUID)
	if err != nil {
		// Log error but don't fail the request
		totalCount = len(builds)
	}

	return c.JSON(fiber.Map{
		"builds":      response,
		"total_count": totalCount,
		"limit":       limit,
		"offset":      offset,
	})
}

// GetBuild retrieves a specific build by ID
func (h *BuildsHandler) GetBuild(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	buildIDStr := c.Params("id")
	buildID, err := uuid.Parse(buildIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid build ID",
		})
	}

	build, err := h.buildRepo.GetBuildByID(buildID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Build not found",
		})
	}

	// Check if the build belongs to the authenticated user
	if build.UserID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	return c.JSON(fiber.Map{
		"build": build.ToResponse(),
	})
}

// UpdateBuild updates an existing build
func (h *BuildsHandler) UpdateBuild(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	buildIDStr := c.Params("id")
	buildID, err := uuid.Parse(buildIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid build ID",
		})
	}

	// Get existing build to check ownership
	existingBuild, err := h.buildRepo.GetBuildByID(buildID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Build not found",
		})
	}

	if existingBuild.UserID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	var req models.UpdateBuildRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Update fields if provided
	if req.Name != nil {
		existingBuild.Name = *req.Name
	}
	if req.Description != nil {
		existingBuild.Description = req.Description
	}
	if req.Character != nil {
		existingBuild.Character = req.Character
	}
	if req.Series != nil {
		existingBuild.Series = req.Series
	}
	if req.Status != nil {
		if !models.IsValidStatus(*req.Status) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid status. Must be one of: idea, sourcing, wip, complete, on_hold, cancelled",
			})
		}
		existingBuild.Status = models.BuildStatus(*req.Status)
	}
	if req.Priority != nil {
		existingBuild.Priority = req.Priority
	}
	if req.Budget != nil {
		existingBuild.Budget = req.Budget
	}
	if req.Spent != nil {
		existingBuild.Spent = req.Spent
	}
	if req.StartDate != nil {
		if *req.StartDate != "" {
			parsedDate, err := time.Parse("2006-01-02", *req.StartDate)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Invalid start date format. Use YYYY-MM-DD",
				})
			}
			existingBuild.StartDate = &parsedDate
		} else {
			existingBuild.StartDate = nil
		}
	}
	if req.TargetDate != nil {
		if *req.TargetDate != "" {
			parsedDate, err := time.Parse("2006-01-02", *req.TargetDate)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Invalid target date format. Use YYYY-MM-DD",
				})
			}
			existingBuild.TargetDate = &parsedDate
		} else {
			existingBuild.TargetDate = nil
		}
	}
	if req.CompletedDate != nil {
		if *req.CompletedDate != "" {
			parsedDate, err := time.Parse("2006-01-02", *req.CompletedDate)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Invalid completed date format. Use YYYY-MM-DD",
				})
			}
			existingBuild.CompletedDate = &parsedDate
		} else {
			existingBuild.CompletedDate = nil
		}
	}
	if req.Tags != nil {
		existingBuild.Tags = req.Tags
	}
	if req.Notes != nil {
		existingBuild.Notes = req.Notes
	}

	existingBuild.UpdatedAt = time.Now()

	if err := h.buildRepo.UpdateBuild(existingBuild); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update build",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Build updated successfully",
		"build":   existingBuild.ToResponse(),
	})
}

// DeleteBuild deletes a build
func (h *BuildsHandler) DeleteBuild(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	buildIDStr := c.Params("id")
	buildID, err := uuid.Parse(buildIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid build ID",
		})
	}

	if err := h.buildRepo.DeleteBuild(buildID, userUUID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Build not found or access denied",
		})
	}

	return c.Status(fiber.StatusNoContent).JSON(fiber.Map{
		"message": "Build deleted successfully",
	})
}

// GetBuildStats retrieves build statistics for the authenticated user
func (h *BuildsHandler) GetBuildStats(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	// Get total count
	totalCount, err := h.buildRepo.GetBuildCount(userUUID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get build statistics",
		})
	}

	// Get counts by status
	ideaCount, _ := h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatusIdea, 1, 0)
	sourcingCount, _ := h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatusSourcing, 1, 0)
	wipCount, _ := h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatusWIP, 1, 0)
	completeCount, _ := h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatusComplete, 1, 0)
	onHoldCount, _ := h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatusOnHold, 1, 0)
	cancelledCount, _ := h.buildRepo.GetBuildsByStatus(userUUID, models.BuildStatusCancelled, 1, 0)

	// Get upcoming builds (next 30 days)
	upcomingBuilds, _ := h.buildRepo.GetUpcomingBuilds(userUUID, 30, 10, 0)

	return c.JSON(fiber.Map{
		"total_builds": totalCount,
		"by_status": fiber.Map{
			"idea":      len(ideaCount),
			"sourcing":  len(sourcingCount),
			"wip":       len(wipCount),
			"complete":  len(completeCount),
			"on_hold":   len(onHoldCount),
			"cancelled": len(cancelledCount),
		},
		"upcoming_builds": len(upcomingBuilds),
	})
}
