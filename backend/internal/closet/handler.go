package closet

import (
	"github.com/gofiber/fiber/v2"
)

const deviceIDHeader = "x-kyar-device-id"

// Handler handles closet API (device-scoped, no auth).
type Handler struct {
	repo *Repository
}

// NewHandler returns a new closet handler.
func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// getDeviceID returns the device id from header or sends 400 and returns nil.
func (h *Handler) getDeviceID(c *fiber.Ctx) string {
	deviceID := c.Get(deviceIDHeader)
	if deviceID == "" {
		_ = c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "missing x-kyar-device-id header",
		})
		return ""
	}
	return deviceID
}

// List returns items for the device, ordered by updatedAt desc.
func (h *Handler) List(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	items, err := h.repo.ListByDevice(c.Context(), deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"items": items})
}

// Create creates a new closet item.
func (h *Handler) Create(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	var in CreateInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if in.Name == "" || in.Category == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name and category required"})
	}
	item, err := h.repo.Create(c.Context(), deviceID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// Update updates an item by id (PATCH).
func (h *Handler) Update(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	var in UpdateInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	item, err := h.repo.Update(c.Context(), id, deviceID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if item == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(item)
}

// Delete deletes an item by id.
func (h *Handler) Delete(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	ok, err := h.repo.Delete(c.Context(), id, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
