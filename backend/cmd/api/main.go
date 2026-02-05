package main

import (
	"log"

	"kyarafit-backend/database"
	"kyarafit-backend/internal/closet"
	"kyarafit-backend/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	app := fiber.New()

	// Initialize database connection
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Initialize closet handler
	closetRepo := closet.NewRepository(database.DB)
	closetHandler := closet.NewHandler(closetRepo, nil)

	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:8081",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"ok": true, "service": "backend"})
	})
	app.Get("/closet/items", closetHandler.List)

	port := config.Port()
	log.Printf("Backend listening on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
