package handlers

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"kyarafit-backend/database"
	"kyarafit-backend/models"
)

type PiecesHandler struct {
	pieceRepo *database.PieceRepository
}

func NewPiecesHandler(pieceRepo *database.PieceRepository) *PiecesHandler {
	return &PiecesHandler{pieceRepo: pieceRepo}
}

// CreatePiece creates a new piece
func (h *PiecesHandler) CreatePiece(c *fiber.Ctx) error {
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

	var req models.CreatePieceRequest
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

	// Parse purchase date if provided
	var purchaseDate *time.Time
	if req.PurchaseDate != nil && *req.PurchaseDate != "" {
		parsedDate, err := time.Parse("2006-01-02", *req.PurchaseDate)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid purchase date format. Use YYYY-MM-DD",
			})
		}
		purchaseDate = &parsedDate
	}

	piece := &models.Piece{
		ID:           uuid.New(),
		UserID:       userUUID,
		Name:         req.Name,
		Description:  req.Description,
		ImageURL:     req.ImageURL,
		ThumbnailURL: req.ThumbnailURL,
		Category:     req.Category,
		Tags:         req.Tags,
		SourceLink:   req.SourceLink,
		PurchaseDate: purchaseDate,
		Price:        req.Price,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := h.pieceRepo.CreatePiece(piece); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create piece",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Piece created successfully",
		"piece":   piece.ToResponse(),
	})
}

// GetPieces retrieves all pieces for the authenticated user
func (h *PiecesHandler) GetPieces(c *fiber.Ctx) error {
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
	category := c.Query("category")
	search := c.Query("search")

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

	var pieces []*models.Piece
	var piecesErr error

	if search != "" {
		pieces, piecesErr = h.pieceRepo.SearchPieces(userUUID, search, limit, offset)
	} else if category != "" {
		pieces, piecesErr = h.pieceRepo.GetPiecesByCategory(userUUID, category, limit, offset)
	} else {
		pieces, piecesErr = h.pieceRepo.GetPiecesByUserID(userUUID, limit, offset)
	}

	if piecesErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve pieces",
		})
	}

	// Convert to response format
	var response []models.PieceResponse
	for _, piece := range pieces {
		response = append(response, piece.ToResponse())
	}

	// Get total count for pagination
	totalCount, err := h.pieceRepo.GetPieceCount(userUUID)
	if err != nil {
		// Log error but don't fail the request
		totalCount = len(pieces)
	}

	return c.JSON(fiber.Map{
		"pieces":      response,
		"total_count": totalCount,
		"limit":       limit,
		"offset":      offset,
	})
}

// GetPiece retrieves a specific piece by ID
func (h *PiecesHandler) GetPiece(c *fiber.Ctx) error {
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

	pieceIDStr := c.Params("id")
	pieceID, err := uuid.Parse(pieceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid piece ID",
		})
	}

	piece, err := h.pieceRepo.GetPieceByID(pieceID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Piece not found",
		})
	}

	// Check if the piece belongs to the authenticated user
	if piece.UserID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	return c.JSON(fiber.Map{
		"piece": piece.ToResponse(),
	})
}

// UpdatePiece updates an existing piece
func (h *PiecesHandler) UpdatePiece(c *fiber.Ctx) error {
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

	pieceIDStr := c.Params("id")
	pieceID, err := uuid.Parse(pieceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid piece ID",
		})
	}

	// Get existing piece to check ownership
	existingPiece, err := h.pieceRepo.GetPieceByID(pieceID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Piece not found",
		})
	}

	if existingPiece.UserID != userUUID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied",
		})
	}

	var req models.UpdatePieceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Update fields if provided
	if req.Name != nil {
		existingPiece.Name = *req.Name
	}
	if req.Description != nil {
		existingPiece.Description = req.Description
	}
	if req.ImageURL != nil {
		existingPiece.ImageURL = req.ImageURL
	}
	if req.ThumbnailURL != nil {
		existingPiece.ThumbnailURL = req.ThumbnailURL
	}
	if req.Category != nil {
		existingPiece.Category = req.Category
	}
	if req.Tags != nil {
		existingPiece.Tags = req.Tags
	}
	if req.SourceLink != nil {
		existingPiece.SourceLink = req.SourceLink
	}
	if req.PurchaseDate != nil {
		if *req.PurchaseDate != "" {
			parsedDate, err := time.Parse("2006-01-02", *req.PurchaseDate)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "Invalid purchase date format. Use YYYY-MM-DD",
				})
			}
			existingPiece.PurchaseDate = &parsedDate
		} else {
			existingPiece.PurchaseDate = nil
		}
	}
	if req.Price != nil {
		existingPiece.Price = req.Price
	}

	existingPiece.UpdatedAt = time.Now()

	if err := h.pieceRepo.UpdatePiece(existingPiece); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update piece",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Piece updated successfully",
		"piece":   existingPiece.ToResponse(),
	})
}

// DeletePiece deletes a piece
func (h *PiecesHandler) DeletePiece(c *fiber.Ctx) error {
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

	pieceIDStr := c.Params("id")
	pieceID, err := uuid.Parse(pieceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid piece ID",
		})
	}

	if err := h.pieceRepo.DeletePiece(pieceID, userUUID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Piece not found or access denied",
		})
	}

	return c.Status(fiber.StatusNoContent).JSON(fiber.Map{
		"message": "Piece deleted successfully",
	})
}

// GetCategories retrieves all unique categories for the authenticated user
func (h *PiecesHandler) GetCategories(c *fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	_, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	// This would require a new method in the repository
	// For now, return a simple response
	return c.JSON(fiber.Map{
		"categories": []string{"wig", "dress", "prop", "shoes", "accessory", "makeup", "other"},
	})
}
