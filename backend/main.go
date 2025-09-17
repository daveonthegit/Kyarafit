package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/cors/v2"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	// CORS configuration
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000,http://localhost:3001",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "kyarafit-backend",
		})
	})

	// API routes
	api := app.Group("/api/v1")
	
	// Closet routes
	api.Get("/closet", getClosetItems)
	api.Post("/closet", createClosetItem)
	api.Get("/closet/:id", getClosetItem)
	api.Put("/closet/:id", updateClosetItem)
	api.Delete("/closet/:id", deleteClosetItem)

	// Build routes
	api.Get("/builds", getBuilds)
	api.Post("/builds", createBuild)
	api.Get("/builds/:id", getBuild)
	api.Put("/builds/:id", updateBuild)
	api.Delete("/builds/:id", deleteBuild)

	// Coord routes
	api.Get("/coords", getCoords)
	api.Post("/coords", createCoord)
	api.Get("/coords/:id", getCoord)
	api.Put("/coords/:id", updateCoord)
	api.Delete("/coords/:id", deleteCoord)

	// Wishlist routes
	api.Get("/wishlist", getWishlistItems)
	api.Post("/wishlist", createWishlistItem)
	api.Put("/wishlist/:id", updateWishlistItem)
	api.Delete("/wishlist/:id", deleteWishlistItem)

	// Convention routes
	api.Get("/conventions", getConventions)
	api.Post("/conventions", createConvention)
	api.Get("/conventions/:id", getConvention)
	api.Put("/conventions/:id", updateConvention)
	api.Delete("/conventions/:id", deleteConvention)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	log.Fatal(app.Listen(":" + port))
}

// Placeholder handlers - implement these based on your data models
func getClosetItems(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"items": []interface{}{}})
}

func createClosetItem(c *fiber.Ctx) error {
	return c.Status(201).JSON(fiber.Map{"message": "Closet item created"})
}

func getClosetItem(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"id": c.Params("id")})
}

func updateClosetItem(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Closet item updated"})
}

func deleteClosetItem(c *fiber.Ctx) error {
	return c.Status(204).Send(nil)
}

func getBuilds(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"builds": []interface{}{}})
}

func createBuild(c *fiber.Ctx) error {
	return c.Status(201).JSON(fiber.Map{"message": "Build created"})
}

func getBuild(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"id": c.Params("id")})
}

func updateBuild(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Build updated"})
}

func deleteBuild(c *fiber.Ctx) error {
	return c.Status(204).Send(nil)
}

func getCoords(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"coords": []interface{}{}})
}

func createCoord(c *fiber.Ctx) error {
	return c.Status(201).JSON(fiber.Map{"message": "Coord created"})
}

func getCoord(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"id": c.Params("id")})
}

func updateCoord(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Coord updated"})
}

func deleteCoord(c *fiber.Ctx) error {
	return c.Status(204).Send(nil)
}

func getWishlistItems(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"items": []interface{}{}})
}

func createWishlistItem(c *fiber.Ctx) error {
	return c.Status(201).JSON(fiber.Map{"message": "Wishlist item created"})
}

func updateWishlistItem(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Wishlist item updated"})
}

func deleteWishlistItem(c *fiber.Ctx) error {
	return c.Status(204).Send(nil)
}

func getConventions(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"conventions": []interface{}{}})
}

func createConvention(c *fiber.Ctx) error {
	return c.Status(201).JSON(fiber.Map{"message": "Convention created"})
}

func getConvention(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"id": c.Params("id")})
}

func updateConvention(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Convention updated"})
}

func deleteConvention(c *fiber.Ctx) error {
	return c.Status(204).Send(nil)
}
