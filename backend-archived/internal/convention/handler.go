package convention

import (
	"kyarafit-backend/internal/appuser"
	"kyarafit-backend/internal/tier"
	"kyarafit-backend/middleware"

	"github.com/gofiber/fiber/v2"
)

const deviceIDHeader = "x-kyar-device-id"

// Handler handles conventions, plan, and packing API.
type Handler struct {
	repo     *Repository
	userRepo *appuser.Repository
}

// NewHandler returns a new convention handler.
func NewHandler(repo *Repository, userRepo *appuser.Repository) *Handler {
	return &Handler{repo: repo, userRepo: userRepo}
}

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

// ListConventions returns conventions for the device.
func (h *Handler) ListConventions(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	list, err := h.repo.ListConventionsByDevice(c.Context(), deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"conventions": list})
}

// GetConvention returns one convention by id.
func (h *Handler) GetConvention(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	conv, err := h.repo.GetConventionByID(c.Context(), id, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if conv == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(conv)
}

// CreateConvention creates a new convention.
func (h *Handler) CreateConvention(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	var in CreateConventionInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if in.Name == "" || in.StartDate == "" || in.EndDate == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name, startDate, endDate required"})
	}
	appUser := middleware.AppUser(c)
	userID := ""
	if appUser != nil {
		limit := tier.Limit(appUser, "max_conventions")
		if limit != tier.Unlimited {
			n, err := h.userRepo.CountConventions(c.Context(), appUser.ID)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
			if n >= limit {
				return c.Status(403).JSON(fiber.Map{"error": "Convention limit reached for your plan. Upgrade for more."})
			}
		}
		storageLimit := tier.Limit(appUser, "storage_mb")
		if storageLimit != tier.Unlimited && appUser.CurrentUsageMB >= storageLimit {
			return c.Status(403).JSON(fiber.Map{"error": "Storage limit reached. Upgrade to continue backing up."})
		}
		userID = appUser.ID
	}
	conv, err := h.repo.CreateConvention(c.Context(), deviceID, userID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if appUser != nil {
		_ = h.userRepo.UpdateUsage(c.Context(), appUser.ID, 1)
	}
	return c.Status(fiber.StatusCreated).JSON(conv)
}

// UpdateConvention updates a convention (PATCH).
func (h *Handler) UpdateConvention(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	var in UpdateConventionInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	conv, err := h.repo.UpdateConvention(c.Context(), id, deviceID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if conv == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(conv)
}

// GetPlan returns the day plan for a convention.
func (h *Handler) GetPlan(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	conv, _ := h.repo.GetConventionByID(c.Context(), id, deviceID)
	if conv == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	plan, err := h.repo.GetPlan(c.Context(), id, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if plan == nil {
		plan = []ConventionDayPlan{}
	}
	return c.JSON(fiber.Map{"plan": plan})
}

// ReplacePlan replaces the day plan (PUT). Body: { "plan": [ { "date": "YYYY-MM-DD", "buildId": "uuid"|null, "notes": "" } ] }
func (h *Handler) ReplacePlan(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	var in ReplacePlanInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if err := h.repo.ReplacePlan(c.Context(), id, deviceID, in.Plan); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	plan, _ := h.repo.GetPlan(c.Context(), id, deviceID)
	if plan == nil {
		plan = []ConventionDayPlan{}
	}
	return c.JSON(fiber.Map{"plan": plan})
}

// GetPacking returns packing list for a convention.
func (h *Handler) GetPacking(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	conv, _ := h.repo.GetConventionByID(c.Context(), id, deviceID)
	if conv == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	list, err := h.repo.GetPackingList(c.Context(), id, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if list == nil {
		list = []PackingListItem{}
	}
	return c.JSON(fiber.Map{"items": list})
}

// RegeneratePacking regenerates packing list and returns new list.
func (h *Handler) RegeneratePacking(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	conv, _ := h.repo.GetConventionByID(c.Context(), id, deviceID)
	if conv == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	list, err := h.repo.RegeneratePackingList(c.Context(), id, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"items": list})
}

// UpdatePackingItem updates a packing item (PATCH /packing/:id). Body: { "checked": bool?, "label": string? }
func (h *Handler) UpdatePackingItem(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	packingID := c.Params("id")
	if packingID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	var in UpdatePackingInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	item, err := h.repo.UpdatePackingItem(c.Context(), packingID, deviceID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if item == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(item)
}

// AddManualPackingItem adds a manual packing item. Body: { "label": string, "date"?: "YYYY-MM-DD", "buildId"?: "uuid" }
func (h *Handler) AddManualPackingItem(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	conventionID := c.Params("id")
	if conventionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	var in AddManualPackingInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if in.Label == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "label required"})
	}
	item, err := h.repo.AddManualPackingItem(c.Context(), conventionID, deviceID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}
