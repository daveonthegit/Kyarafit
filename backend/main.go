package main

import (
	"encoding/json"
	"log"
	"os"
	"strings"

	"kyarafit-backend/database"
	"kyarafit-backend/handlers"
	"kyarafit-backend/internal/appuser"
	"kyarafit-backend/internal/builds"
	"kyarafit-backend/internal/closet"
	"kyarafit-backend/internal/convention"
	"kyarafit-backend/internal/email"
	"kyarafit-backend/internal/tier"
	"kyarafit-backend/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
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

	// CORS configuration (8081 = Expo web dev server)
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000,http://localhost:3001,http://localhost:8081,http://127.0.0.1:3000,http://127.0.0.1:8081",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,x-kyar-device-id,x-kyar-client",
		AllowCredentials: true,
	}))

	// JWT middleware configuration
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is required. Refusing to start with insecure default.")
	}
	jwtCfg := middleware.JWTConfig{Secret: jwtSecret}

	userRepo := appuser.NewRepository(database.DB)
	requireWeb := middleware.RequireWebAccess(jwtCfg, userRepo)
	optionalUser := middleware.OptionalAppUser(jwtCfg, userRepo)

	// Initialize repositories and handlers
	pieceRepo := database.NewPieceRepository(database.DB)
	piecesHandler := handlers.NewPiecesHandler(pieceRepo)

	buildRepo := database.NewBuildRepository(database.DB)
	legacyBuildsHandler := handlers.NewBuildsHandler(buildRepo)

	// Initialize email client (optional)
	var emailClient *email.Client
	var emailHandler *email.Handler
	emailClient, err := email.NewClient()
	if err != nil {
		log.Println("Warning: Email client not initialized:", err)
		log.Println("Email features will be disabled. Configure SMTP_* environment variables to enable email.")
	} else {
		emailHandler = email.NewHandler(emailClient)
		// Verify SMTP connection on startup (optional)
		if err := emailClient.Verify(); err != nil {
			log.Println("Warning: SMTP verification failed:", err)
		} else {
			log.Println("Email service initialized successfully")
		}
	}

	// Health check endpoint
	app.Get("/health", func(c *fiber.Ctx) error {
		health := fiber.Map{
			"status":  "ok",
			"service": "kyarafit-backend",
		}
		if emailClient != nil {
			health["email"] = "configured"
		} else {
			health["email"] = "not_configured"
		}
		return c.JSON(health)
	})

	// Closet API (device-scoped; optional JWT for tier/limits)
	closetRepo := closet.NewRepository(database.DB)
	closetHandler := closet.NewHandler(closetRepo, userRepo)
	closetGroup := app.Group("/closet", optionalUser)
	closetGroup.Get("/items", closetHandler.List)
	closetGroup.Post("/items", closetHandler.Create)
	closetGroup.Patch("/items/:id", closetHandler.Update)
	closetGroup.Delete("/items/:id", closetHandler.Delete)

	// Builds API (device-scoped; optional JWT for tier/limits)
	deviceBuildsRepo := builds.NewRepository(database.DB)
	deviceBuildsHandler := builds.NewHandler(deviceBuildsRepo, userRepo)
	buildsGroup := app.Group("", optionalUser)
	buildsGroup.Get("/builds", deviceBuildsHandler.List)
	buildsGroup.Post("/builds", deviceBuildsHandler.Create)
	buildsGroup.Get("/builds/:id", deviceBuildsHandler.Get)
	buildsGroup.Patch("/builds/:id", deviceBuildsHandler.Update)
	buildsGroup.Get("/builds/:id/items", deviceBuildsHandler.GetItems)
	buildsGroup.Post("/builds/:id/items", deviceBuildsHandler.LinkItems)
	buildsGroup.Get("/builds/:id/tasks", deviceBuildsHandler.GetTasks)
	buildsGroup.Post("/builds/:id/tasks", deviceBuildsHandler.CreateTask)
	buildsGroup.Patch("/builds/:id/tasks/:taskId", deviceBuildsHandler.UpdateTask)
	buildsGroup.Delete("/builds/:id/tasks/:taskId", deviceBuildsHandler.DeleteTask)

	// Conventions API (device-scoped; optional JWT for tier/limits)
	conventionRepo := convention.NewRepository(database.DB)
	conventionHandler := convention.NewHandler(conventionRepo, userRepo)
	conventionGroup := app.Group("", optionalUser)
	conventionGroup.Get("/conventions", conventionHandler.ListConventions)
	conventionGroup.Post("/conventions", conventionHandler.CreateConvention)
	conventionGroup.Get("/conventions/:id", conventionHandler.GetConvention)
	conventionGroup.Patch("/conventions/:id", conventionHandler.UpdateConvention)
	conventionGroup.Get("/conventions/:id/plan", conventionHandler.GetPlan)
	conventionGroup.Put("/conventions/:id/plan", conventionHandler.ReplacePlan)
	conventionGroup.Get("/conventions/:id/packing", conventionHandler.GetPacking)
	conventionGroup.Post("/conventions/:id/packing/regenerate", conventionHandler.RegeneratePacking)
	conventionGroup.Post("/conventions/:id/packing/manual", conventionHandler.AddManualPackingItem)
	conventionGroup.Patch("/packing/:id", conventionHandler.UpdatePackingItem)

	// API routes (web editor: require at least FREE tier)
	api := app.Group("/api/v1")
	protected := api.Group("/", requireWeb)

	// Me: tier and usage for web/mobile
	protected.Get("/me", func(c *fiber.Ctx) error {
		u := middleware.AppUser(c)
		if u == nil {
			return c.Status(401).JSON(fiber.Map{"error": "Sign in required to use web editor."})
		}
		storageLimit := tier.Limit(u, "storage_mb")
		return c.JSON(fiber.Map{
			"tier":           u.Tier,
			"currentUsageMb": u.CurrentUsageMB,
			"storageLimitMb": storageLimit, // -1 = unlimited
		})
	})

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
	protected.Get("/builds", legacyBuildsHandler.GetBuilds)
	protected.Post("/builds", legacyBuildsHandler.CreateBuild)
	protected.Get("/builds/:id", legacyBuildsHandler.GetBuild)
	protected.Put("/builds/:id", legacyBuildsHandler.UpdateBuild)
	protected.Delete("/builds/:id", legacyBuildsHandler.DeleteBuild)
	protected.Get("/builds/stats", legacyBuildsHandler.GetBuildStats)

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

	// Export: PREMIUM_BASIC for JSON, PREMIUM_PRO for CSV/PDF
	protected.Get("/export", exportHandler(userRepo))

	// Email test endpoints (only available if email is configured)
	if emailHandler != nil {
		testGroup := app.Group("/api/test")
		testGroup.Post("/email", emailHandler.SendTestEmail)
		testGroup.Get("/email/verify", emailHandler.VerifyConfiguration)
	}

	// Stripe webhook: update user tier and storage quota (no JWT)
	// TODO SECURITY: Implement Stripe signature verification before enabling in production
	// See: https://stripe.com/docs/webhooks/signatures
	// DISABLED until signature verification is implemented to prevent tier bypass attacks
	// app.Post("/webhooks/stripe", stripeWebhookHandler(userRepo))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	log.Fatal(app.Listen(":" + port))
}

// exportHandler returns a handler that exports data. PREMIUM_BASIC: JSON only; PREMIUM_PRO: JSON, CSV, PDF.
func exportHandler(userRepo *appuser.Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		u := middleware.AppUser(c)
		if u == nil {
			return c.Status(401).JSON(fiber.Map{"error": "Sign in required to use web editor."})
		}
		format := strings.ToLower(strings.TrimSpace(c.Query("format", "json")))
		if format == "" {
			format = "json"
		}
		if !tier.Can(u, "export_import") {
			return c.Status(403).JSON(fiber.Map{"error": "Export requires Premium. Upgrade to back up and export your data."})
		}
		if !tier.CanExportFormat(u, format) {
			return c.Status(403).JSON(fiber.Map{"error": "This export format requires Premium Pro."})
		}
		// Stub: return minimal payload; real implementation would aggregate device data by user
		return c.JSON(fiber.Map{"export": "stub", "format": format})
	}
}

// stripeWebhookHandler handles Stripe subscription events: map price_id -> tier, update user.
// TODO SECURITY: This handler MUST verify Stripe webhook signatures before production use.
// Without signature verification, attackers can forge webhook events and grant themselves premium tiers.
// Implementation required:
// 1. Add github.com/stripe/stripe-go/v76 to go.mod
// 2. Set STRIPE_WEBHOOK_SECRET environment variable
// 3. Use webhook.ConstructEvent() to verify signature
// Example: https://stripe.com/docs/webhooks/signatures
func stripeWebhookHandler(userRepo *appuser.Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// SECURITY: Verify Stripe-Signature header before processing
		webhookSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
		if webhookSecret == "" {
			log.Println("WARNING: STRIPE_WEBHOOK_SECRET not set. Webhook endpoint should be disabled.")
			return c.Status(500).JSON(fiber.Map{"error": "webhook not configured"})
		}

		// TODO: Implement actual signature verification:
		// signature := c.Get("Stripe-Signature")
		// event, err := webhook.ConstructEvent(c.Body(), signature, webhookSecret)
		// if err != nil {
		//     return c.Status(400).JSON(fiber.Map{"error": "invalid signature"})
		// }

		var evt struct {
			Type string `json:"type"`
			Data struct {
				Object json.RawMessage `json:"object"`
			} `json:"data"`
		}
		if err := c.BodyParser(&evt); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
		}
		switch evt.Type {
		case "customer.subscription.updated", "customer.subscription.created":
			var sub struct {
				ID       string `json:"id"`
				Customer string `json:"customer"`
				Items    struct {
					Data []struct {
						Price struct {
							ID string `json:"id"`
						} `json:"price"`
					} `json:"data"`
				} `json:"items"`
			}
			if err := json.Unmarshal(evt.Data.Object, &sub); err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "invalid object"})
			}
			if len(sub.Items.Data) == 0 {
				return c.SendStatus(200)
			}
			priceID := sub.Items.Data[0].Price.ID
			newTier := tier.FREE
			switch priceID {
			case os.Getenv("STRIPE_PRICE_BASIC"):
				newTier = tier.PREMIUM_BASIC
			case os.Getenv("STRIPE_PRICE_PRO"):
				newTier = tier.PREMIUM_PRO
			}
			// Resolve customer -> user_id (e.g. from Stripe customer metadata or your DB)
			// Stub: expect metadata or lookup table; for now we just 200 and log
			_ = newTier
			log.Printf("Stripe webhook: %s customer=%s price=%s -> tier=%s", evt.Type, sub.Customer, priceID, newTier)
		case "customer.subscription.deleted":
			// Downgrade: set tier to FREE; do not delete data
			var sub struct {
				Customer string `json:"customer"`
			}
			if err := json.Unmarshal(evt.Data.Object, &sub); err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "invalid object"})
			}
			log.Printf("Stripe webhook: subscription deleted customer=%s", sub.Customer)
		}
		return c.SendStatus(200)
	}
}

// Placeholder handlers - implement these based on your data models
func getClosetItems(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.JSON(fiber.Map{
		"items":  []interface{}{},
		"userID": userID,
	})
}

func createClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.Status(201).JSON(fiber.Map{
		"message": "Closet item created",
		"userID":  userID,
	})
}

func getClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.JSON(fiber.Map{
		"id":     c.Params("id"),
		"userID": userID,
	})
}

func updateClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.JSON(fiber.Map{
		"message": "Closet item updated",
		"userID":  userID,
	})
}

func deleteClosetItem(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	return c.Status(204).JSON(fiber.Map{
		"message": "Closet item deleted",
		"userID":  userID,
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
