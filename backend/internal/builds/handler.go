package builds

import (
	"kyarafit-backend/internal/appuser"
	"kyarafit-backend/internal/tier"
	"kyarafit-backend/middleware"

	"github.com/gofiber/fiber/v2"
)

const deviceIDHeader = "x-kyar-device-id"

// Handler handles device-scoped builds API.
type Handler struct {
	repo     *Repository
	userRepo *appuser.Repository
}

// NewHandler returns a new builds handler.
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

// List returns builds for the device.
func (h *Handler) List(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	list, err := h.repo.ListByDevice(c.Context(), deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"builds": list})
}

// Create creates a new build.
func (h *Handler) Create(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	var in CreateBuildInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if in.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name required"})
	}
	if in.Status != "" && in.Status != "idea" && in.Status != "wip" && in.Status != "ready" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status must be idea, wip, or ready"})
	}
	appUser := middleware.AppUser(c)
	userID := ""
	if appUser != nil {
		limit := tier.Limit(appUser, "max_builds")
		if limit != tier.Unlimited {
			n, err := h.userRepo.CountBuilds(c.Context(), appUser.ID)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
			if n >= limit {
				return c.Status(403).JSON(fiber.Map{"error": "Build limit reached for your plan. Upgrade for more builds."})
			}
		}
		storageLimit := tier.Limit(appUser, "storage_mb")
		if storageLimit != tier.Unlimited && appUser.CurrentUsageMB >= storageLimit {
			return c.Status(403).JSON(fiber.Map{"error": "Storage limit reached. Upgrade to continue backing up."})
		}
		userID = appUser.ID
	}
	build, err := h.repo.Create(c.Context(), deviceID, userID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if appUser != nil {
		_ = h.userRepo.UpdateUsage(c.Context(), appUser.ID, 1)
	}
	return c.Status(fiber.StatusCreated).JSON(build)
}

// Get returns a build by id.
func (h *Handler) Get(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	build, err := h.repo.GetByID(c.Context(), id, deviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(build)
}

// Update updates a build (PATCH).
func (h *Handler) Update(c *fiber.Ctx) error {
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
	var in UpdateBuildInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if in.Status != nil && *in.Status != "idea" && *in.Status != "wip" && *in.Status != "ready" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "status must be idea, wip, or ready"})
	}
	build, err := h.repo.Update(c.Context(), id, deviceID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(build)
}

// LinkItems replaces linked closet items for a build. Body: { "closetItemIds": ["uuid", ...] }.
func (h *Handler) LinkItems(c *fiber.Ctx) error {
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
	var in LinkItemsInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	build, _ := h.repo.GetByID(c.Context(), id, deviceID)
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	if err := h.repo.LinkItems(c.Context(), id, deviceID, in.ClosetItemIDs); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusNoContent).Send(nil)
}

// GetItems returns linked closet item IDs for a build.
func (h *Handler) GetItems(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	build, _ := h.repo.GetByID(c.Context(), id, deviceID)
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	ids, err := h.repo.GetLinkedClosetItemIDs(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"closetItemIds": ids})
}

// GetTasks returns tasks for a build.
func (h *Handler) GetTasks(c *fiber.Ctx) error {
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id required"})
	}
	build, _ := h.repo.GetByID(c.Context(), id, deviceID)
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	tasks, err := h.repo.ListTasks(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"tasks": tasks})
}

// CreateTask creates a task for a build.
func (h *Handler) CreateTask(c *fiber.Ctx) error {
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
	build, _ := h.repo.GetByID(c.Context(), id, deviceID)
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	var in CreateBuildTaskInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if in.Label == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "label required"})
	}
	task, err := h.repo.CreateTask(c.Context(), id, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(task)
}

// UpdateTask updates a task (PATCH). taskId is the second param.
func (h *Handler) UpdateTask(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	buildID := c.Params("id")
	taskID := c.Params("taskId")
	if buildID == "" || taskID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id and taskId required"})
	}
	build, _ := h.repo.GetByID(c.Context(), buildID, deviceID)
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	var in UpdateBuildTaskInput
	if err := c.BodyParser(&in); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	task, err := h.repo.UpdateTask(c.Context(), taskID, buildID, in)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if task == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
	}
	return c.JSON(task)
}

// DeleteTask deletes a task.
func (h *Handler) DeleteTask(c *fiber.Ctx) error {
	if err := middleware.AllowSyncWrite(c); err != nil {
		return err
	}
	deviceID := h.getDeviceID(c)
	if deviceID == "" {
		return nil
	}
	buildID := c.Params("id")
	taskID := c.Params("taskId")
	if buildID == "" || taskID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id and taskId required"})
	}
	build, _ := h.repo.GetByID(c.Context(), buildID, deviceID)
	if build == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	ok, err := h.repo.DeleteTask(c.Context(), taskID, buildID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "task not found"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
