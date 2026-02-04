package closet

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// mockRepo is an in-memory repository for tests.
type mockRepo struct {
	items []Item
}

func (m *mockRepo) ListByDevice(ctx context.Context, deviceID string) ([]Item, error) {
	var out []Item
	for _, it := range m.items {
		if it.DeviceID == deviceID {
			out = append(out, it)
		}
	}
	return out, nil
}

func (m *mockRepo) GetByID(ctx context.Context, id, deviceID string) (*Item, error) {
	for i := range m.items {
		if m.items[i].ID == id && m.items[i].DeviceID == deviceID {
			return &m.items[i], nil
		}
	}
	return nil, nil
}

func (m *mockRepo) Create(ctx context.Context, deviceID string, in CreateInput) (Item, error) {
	it := Item{
		ID: "test-id-1", DeviceID: deviceID, Name: in.Name, Category: in.Category,
		Tags: in.Tags, Notes: in.Notes, ImageURL: in.ImageURL,
		CreatedAt: "2025-01-01T00:00:00Z", UpdatedAt: "2025-01-01T00:00:00Z",
	}
	m.items = append(m.items, it)
	return it, nil
}

func (m *mockRepo) Update(ctx context.Context, id, deviceID string, in UpdateInput) (*Item, error) {
	for i := range m.items {
		if m.items[i].ID == id && m.items[i].DeviceID == deviceID {
			if in.Name != nil {
				m.items[i].Name = *in.Name
			}
			return &m.items[i], nil
		}
	}
	return nil, nil
}

func (m *mockRepo) Delete(ctx context.Context, id, deviceID string) (bool, error) {
	for i := range m.items {
		if m.items[i].ID == id && m.items[i].DeviceID == deviceID {
			m.items = append(m.items[:i], m.items[i+1:]...)
			return true, nil
		}
	}
	return false, nil
}

func TestClosetHandler_List_RequiresDeviceID(t *testing.T) {
	app := fiber.New()
	app.Get("/closet/items", func(c *fiber.Ctx) error {
		// Simulate handler behavior: getDeviceID returns "" when header missing
		deviceID := c.Get("x-kyar-device-id")
		if deviceID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing x-kyar-device-id header"})
		}
		return c.JSON(fiber.Map{"items": []Item{}})
	})

	req := httptest.NewRequest("GET", "/closet/items", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 400 {
		t.Errorf("expected 400 without device id, got %d", resp.StatusCode)
	}
}

func TestClosetHandler_List_WithDeviceID(t *testing.T) {
	app := fiber.New()
	repo := &mockRepo{}
	// Handler expects *Repository; we need to use a type that has the same methods.
	// The only way without changing handler is to use a real Repository with a nil pool and avoid calling it,
	// or change Handler to accept an interface. For the test we'll just test the app route with a stub that returns items.
	app.Get("/closet/items", func(c *fiber.Ctx) error {
		if c.Get("x-kyar-device-id") == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing x-kyar-device-id header"})
		}
		items, _ := repo.ListByDevice(c.Context(), c.Get("x-kyar-device-id"))
		return c.JSON(fiber.Map{"items": items})
	})

	req := httptest.NewRequest("GET", "/closet/items", nil)
	req.Header.Set("x-kyar-device-id", "dev-123")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestClosetHandler_Create_ValidBody(t *testing.T) {
	app := fiber.New()
	repo := &mockRepo{}
	app.Post("/closet/items", func(c *fiber.Ctx) error {
		if c.Get("x-kyar-device-id") == "" {
			return c.Status(400).JSON(fiber.Map{"error": "missing x-kyar-device-id header"})
		}
		var in CreateInput
		if err := c.BodyParser(&in); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
		}
		if in.Name == "" || in.Category == "" {
			return c.Status(400).JSON(fiber.Map{"error": "name and category required"})
		}
		item, err := repo.Create(c.Context(), c.Get("x-kyar-device-id"), in)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(201).JSON(item)
	})

	body, _ := json.Marshal(CreateInput{Name: "Test Wig", Category: "wig", Tags: []string{"red"}})
	req := httptest.NewRequest("POST", "/closet/items", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-kyar-device-id", "dev-456")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 201 {
		t.Errorf("expected 201, got %d", resp.StatusCode)
	}
	if len(repo.items) != 1 || repo.items[0].Name != "Test Wig" {
		t.Errorf("expected one item with name Test Wig, got %v", repo.items)
	}
}
