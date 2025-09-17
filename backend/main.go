package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"kyarafit-backend/middleware"
	"kyarafit-backend/database"
	"kyarafit-backend/handlers"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Connect to database
	if err := database.Connect(); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer database.Close()

	// Run database migrations
	if err := database.RunMigrations(); err != nil {
		log.Fatal("Failed to run migrations:", err)
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

	// JWT middleware configuration
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "your-super-secret-jwt-key-here"
	}
	authMiddleware := middleware.NewJWTMiddleware(middleware.JWTConfig{
		Secret: jwtSecret,
	})

	// Initialize repositories and handlers
	pieceRepo := database.NewPieceRepository(database.DB)
	piecesHandler := handlers.NewPiecesHandler(pieceRepo)
	
	buildRepo := database.NewBuildRepository(database.DB)
	buildsHandler := handlers.NewBuildsHandler(buildRepo)

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "kyarafit-backend",
		})
	})

	// API routes
	api := app.Group("/api/v1")
	
	// Protected routes (require authentication)
	protected := api.Group("/", authMiddleware)
	
	// Pieces routes (protected)
	protected.Get("/pieces", piecesHandler.GetPieces)
	protected.Post("/pieces", piecesHandler.CreatePiece)
	protected.Get("/pieces/:id", piecesHandler.GetPiece)
	protected.Put("/pieces/:id", piecesHandler.UpdatePiece)
	protected.Delete("/pieces/:id", piecesHandler.DeletePiece)
	protected.Get("/pieces/categories", piecesHandler.GetCategories)
	
	// Legacy closet routes (redirect to pieces)
	protected.Get("/closet", piecesHandler.GetPieces)
	protected.Post("/closet", piecesHandler.CreatePiece)
	protected.Get("/closet/:id", piecesHandler.GetPiece)
	protected.Put("/closet/:id", piecesHandler.UpdatePiece)
	protected.Delete("/closet/:id", piecesHandler.DeletePiece)

	// Build routes (protected)
	protected.Get("/builds", buildsHandler.GetBuilds)
	protected.Post("/builds", buildsHandler.CreateBuild)
	protected.Get("/builds/:id", buildsHandler.GetBuild)
	protected.Put("/builds/:id", buildsHandler.UpdateBuild)
	protected.Delete("/builds/:id", buildsHandler.DeleteBuild)
	protected.Get("/builds/stats", buildsHandler.GetBuildStats)

	// Coord routes (protected)
	protected.Get("/coords", getCoords)
	protected.Post("/coords", createCoord)
	protected.Get("/coords/:id", getCoord)
	protected.Put("/coords/:id", updateCoord)
	protected.Delete("/coords/:id", deleteCoord)

	// Wishlist routes (protected)
	protected.Get("/wishlist", getWishlistItems)
	protected.Post("/wishlist", createWishlistItem)
	protected.Put("/wishlist/:id", updateWishlistItem)
	protected.Delete("/wishlist/:id", deleteWishlistItem)

	// Convention routes (protected)
	protected.Get("/conventions", getConventions)
	protected.Post("/conventions", createConvention)
	protected.Get("/conventions/:id", getConvention)
	protected.Put("/conventions/:id", updateConvention)
	protected.Delete("/conventions/:id", deleteConvention)

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
	userID := c.Locals("userID").(string)
	return c.JSON(fiber.Map{
		"items": []interface{}{},
		"userID": userID,
	})
}

func createClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.Status(201).JSON(fiber.Map{
		"message": "Closet item created",
		"userID": userID,
	})
}

func getClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.JSON(fiber.Map{
		"id": c.Params("id"),
		"userID": userID,
	})
}

func updateClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.JSON(fiber.Map{
		"message": "Closet item updated",
		"userID": userID,
	})
}

func deleteClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.Status(204).JSON(fiber.Map{
		"message": "Closet item deleted",
		"userID": userID,
	})
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
