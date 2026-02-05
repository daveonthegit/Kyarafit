package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kyarafit-backend/database"
	"kyarafit-backend/handlers"
	"kyarafit-backend/internal/appuser"
	"kyarafit-backend/internal/builds"
	"kyarafit-backend/internal/closet"
	"kyarafit-backend/internal/convention"
	"kyarafit-backend/internal/email"
	"kyarafit-backend/internal/seed"
	"kyarafit-backend/internal/storage"
	"kyarafit-backend/internal/sync"
	"kyarafit-backend/internal/tier"
	"kyarafit-backend/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/google/uuid"
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
	
	// Conventions API (device-scoped; optional JWT for tier/limits)
	conventionRepo := convention.NewRepository(database.DB)
	conventionHandler := convention.NewHandler(conventionRepo, userRepo)
	
	buildsGroup := app.Group("", optionalUser)
	buildsGroup.Get("/builds", wrapWithSeed(deviceBuildsHandler.List, deviceBuildsRepo, conventionRepo))
	buildsGroup.Post("/builds", deviceBuildsHandler.Create)
	buildsGroup.Get("/builds/:id", deviceBuildsHandler.Get)
	buildsGroup.Patch("/builds/:id", deviceBuildsHandler.Update)
	buildsGroup.Get("/builds/:id/items", deviceBuildsHandler.GetItems)
	buildsGroup.Post("/builds/:id/items", deviceBuildsHandler.LinkItems)
	buildsGroup.Get("/builds/:id/tasks", deviceBuildsHandler.GetTasks)
	buildsGroup.Post("/builds/:id/tasks", deviceBuildsHandler.CreateTask)
	buildsGroup.Patch("/builds/:id/tasks/:taskId", deviceBuildsHandler.UpdateTask)
	buildsGroup.Delete("/builds/:id/tasks/:taskId", deviceBuildsHandler.DeleteTask)
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

	// Image upload endpoint
	protected.Post("/upload/image", uploadImageHandler(userRepo))

	// Sync endpoints (require PREMIUM_BASIC+ for cloud sync)
	syncRepo := sync.NewRepository(database.DB)
	syncGroup := protected.Group("/sync", middleware.RequireCloudSync)
	syncGroup.Get("/pull", syncPullHandler(syncRepo))

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

	// User sync endpoint: for debugging/admin (protected by web access)
	protected.Get("/users/me", getUserInfo(userRepo))
	protected.Post("/users/sync", syncUserInfo(userRepo))

	// Seed data endpoint: manually trigger seed data creation
	app.Post("/api/seed", optionalUser, seedDataHandler(deviceBuildsRepo, conventionRepo))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	log.Fatal(app.Listen(":" + port))
}

// uploadImageHandler handles image uploads to Supabase Storage with quota checks
func uploadImageHandler(userRepo *appuser.Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get authenticated user
		u := middleware.AppUser(c)
		if u == nil {
			return c.Status(401).JSON(fiber.Map{"error": "Authentication required"})
		}

		// Check if user's tier allows image uploads (FREE+ for web, PREMIUM_BASIC+ for mobile)
		clientType := c.Get("x-kyar-client", "web")
		if clientType == "mobile" && u.Tier < tier.PREMIUM_BASIC {
			return c.Status(403).JSON(fiber.Map{"error": "Image uploads on mobile require Premium Basic or higher"})
		}

		// Get category from form data
		category := c.FormValue("category")
		if category == "" {
			category = "builds"
		}
		// Validate category
		validCategories := map[string]bool{"builds": true, "conventions": true, "closet": true}
		if !validCategories[category] {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid category. Must be: builds, conventions, or closet"})
		}

		// Get uploaded file
		file, err := c.FormFile("file")
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "No file uploaded"})
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024 // 5MB
		if file.Size > maxSize {
			return c.Status(400).JSON(fiber.Map{"error": "File too large. Maximum size is 5MB"})
		}

		// Validate file type
		ext := strings.ToLower(filepath.Ext(file.Filename))
		validExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
		if !validExts[ext] {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid file type. Allowed: jpg, jpeg, png, webp, gif"})
		}

		// Check storage quota
		storageLimit := tier.Limit(u, "storage_mb")
		if storageLimit != tier.Unlimited {
			fileSizeMB := float64(file.Size) / (1024 * 1024)
			if u.CurrentUsageMB+fileSizeMB > float64(storageLimit) {
				return c.Status(403).JSON(fiber.Map{
					"error":          "Storage limit reached. Upgrade to continue uploading.",
					"currentUsageMb": u.CurrentUsageMB,
					"storageLimitMb": storageLimit,
				})
			}
		}

		// Open file
		src, err := file.Open()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to read file"})
		}
		defer src.Close()

		// Generate unique filename
		filename := fmt.Sprintf("%s/%s%s", category, uuid.New().String(), ext)

		// Upload to Supabase Storage
		storageClient := storage.NewSupabaseStorage()
		publicURL, err := storageClient.Upload(u.ID, filename, src)
		if err != nil {
			log.Printf("Storage upload error: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to upload image"})
		}

		// Update user's storage usage
		fileSizeMB := float64(file.Size) / (1024 * 1024)
		if err := userRepo.UpdateUsage(c.Context(), u.ID, fileSizeMB); err != nil {
			log.Printf("Failed to update usage for user %s: %v", u.ID, err)
			// Don't fail the request - image was uploaded successfully
		}

		return c.Status(201).JSON(fiber.Map{
			"url":    publicURL,
			"size":   file.Size,
			"sizeMb": fmt.Sprintf("%.2f", fileSizeMB),
		})
	}
}

// syncPullHandler handles sync pull requests with timestamp filtering
func syncPullHandler(syncRepo *sync.Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		u := middleware.AppUser(c)
		if u == nil {
			return c.Status(401).JSON(fiber.Map{"error": "Authentication required"})
		}

		// Parse optional "since" timestamp
		var since *time.Time
		sinceStr := c.Query("since")
		if sinceStr != "" {
			t, err := time.Parse(time.RFC3339, sinceStr)
			if err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "Invalid since timestamp. Use RFC3339 format"})
			}
			since = &t
		}

		// Pull changes since timestamp
		resp, err := syncRepo.Pull(c.Context(), u.ID, since)
		if err != nil {
			log.Printf("Sync pull error for user %s: %v", u.ID, err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch sync data"})
		}

		return c.JSON(resp)
	}
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

		ctx := c.Context()
		switch evt.Type {
		case "customer.subscription.updated", "customer.subscription.created":
			var sub struct {
				ID               string `json:"id"`
				Customer         string `json:"customer"`
				Status           string `json:"status"`
				CurrentPeriodEnd int64  `json:"current_period_end"`
				Items            struct {
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

			// Determine tier from price ID
			priceID := sub.Items.Data[0].Price.ID
			newTier := tier.FREE
			switch priceID {
			case os.Getenv("STRIPE_PRICE_BASIC"):
				newTier = tier.PREMIUM_BASIC
			case os.Getenv("STRIPE_PRICE_PRO"):
				newTier = tier.PREMIUM_PRO
			}

			// Find user by Stripe customer ID
			user, err := userRepo.GetByStripeCustomerID(ctx, sub.Customer)
			if err != nil {
				log.Printf("Error finding user for customer %s: %v", sub.Customer, err)
				return c.Status(500).JSON(fiber.Map{"error": "database error"})
			}
			if user == nil {
				log.Printf("No user found for Stripe customer %s", sub.Customer)
				return c.SendStatus(200) // Don't fail webhook if user not found
			}

			// Convert Unix timestamp to ISO8601 string
			var periodEndPtr *string
			if sub.CurrentPeriodEnd > 0 {
				t := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
				periodEnd := t.Format(time.RFC3339)
				periodEndPtr = &periodEnd
			}

			// Update user tier and subscription info
			err = userRepo.SetTierAndSubscription(ctx, user.ID, newTier, sub.ID, sub.Status, periodEndPtr)
			if err != nil {
				log.Printf("Error updating user %s subscription: %v", user.ID, err)
				return c.Status(500).JSON(fiber.Map{"error": "failed to update user"})
			}

			log.Printf("Stripe webhook: %s customer=%s user=%s price=%s status=%s -> tier=%s",
				evt.Type, sub.Customer, user.ID, priceID, sub.Status, newTier)

		case "customer.subscription.deleted":
			var sub struct {
				ID       string `json:"id"`
				Customer string `json:"customer"`
			}
			if err := json.Unmarshal(evt.Data.Object, &sub); err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "invalid object"})
			}

			// Find user by Stripe customer ID
			user, err := userRepo.GetByStripeCustomerID(ctx, sub.Customer)
			if err != nil {
				log.Printf("Error finding user for customer %s: %v", sub.Customer, err)
				return c.Status(500).JSON(fiber.Map{"error": "database error"})
			}
			if user == nil {
				log.Printf("No user found for Stripe customer %s", sub.Customer)
				return c.SendStatus(200)
			}

			// Downgrade to FREE tier but keep subscription_id for history
			err = userRepo.SetTierAndSubscription(ctx, user.ID, tier.FREE, sub.ID, "canceled", nil)
			if err != nil {
				log.Printf("Error downgrading user %s: %v", user.ID, err)
				return c.Status(500).JSON(fiber.Map{"error": "failed to update user"})
			}

			log.Printf("Stripe webhook: subscription deleted customer=%s user=%s -> tier=FREE", sub.Customer, user.ID)

		case "customer.created":
			// Store customer ID when a customer is created
			var customer struct {
				ID       string                 `json:"id"`
				Metadata map[string]interface{} `json:"metadata"`
			}
			if err := json.Unmarshal(evt.Data.Object, &customer); err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "invalid object"})
			}

			// Get user_id from metadata (you should set this when creating the customer)
			userIDVal, ok := customer.Metadata["user_id"]
			if !ok {
				log.Printf("No user_id in customer metadata for customer %s", customer.ID)
				return c.SendStatus(200)
			}
			userID, ok := userIDVal.(string)
			if !ok {
				log.Printf("Invalid user_id type in customer metadata for customer %s", customer.ID)
				return c.SendStatus(200)
			}

			err := userRepo.UpdateStripeCustomer(ctx, userID, customer.ID)
			if err != nil {
				log.Printf("Error updating customer ID for user %s: %v", userID, err)
				return c.Status(500).JSON(fiber.Map{"error": "failed to update user"})
			}

			log.Printf("Stripe webhook: customer created %s -> user=%s", customer.ID, userID)
		}

		return c.SendStatus(200)
	}
}

// getUserInfo returns detailed user info including subscription status
func getUserInfo(userRepo *appuser.Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		u := middleware.AppUser(c)
		if u == nil {
			return c.Status(401).JSON(fiber.Map{"error": "Sign in required"})
		}

		storageLimit := tier.Limit(u, "storage_mb")
		return c.JSON(fiber.Map{
			"id":                           u.ID,
			"email":                        u.Email,
			"emailConfirmed":               u.EmailConfirmed,
			"tier":                         u.Tier,
			"currentUsageMb":               u.CurrentUsageMB,
			"storageLimitMb":               storageLimit,
			"stripeCustomerId":             u.StripeCustomerID,
			"stripeSubscriptionId":         u.StripeSubscriptionID,
			"subscriptionStatus":           u.SubscriptionStatus,
			"subscriptionCurrentPeriodEnd": u.SubscriptionCurrentPeriodEnd,
		})
	}
}

// syncUserInfo manually triggers a user info sync (useful for debugging)
func syncUserInfo(userRepo *appuser.Repository) fiber.Handler {
	return func(c *fiber.Ctx) error {
		u := middleware.AppUser(c)
		if u == nil {
			return c.Status(401).JSON(fiber.Map{"error": "Sign in required"})
		}

		// In a real implementation, you might fetch latest data from Supabase auth
		// For now, just return current info
		updated, err := userRepo.GetByID(c.Context(), u.ID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		if updated == nil {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}

		storageLimit := tier.Limit(updated, "storage_mb")
		return c.JSON(fiber.Map{
			"id":                           updated.ID,
			"email":                        updated.Email,
			"emailConfirmed":               updated.EmailConfirmed,
			"tier":                         updated.Tier,
			"currentUsageMb":               updated.CurrentUsageMB,
			"storageLimitMb":               storageLimit,
			"stripeCustomerId":             updated.StripeCustomerID,
			"stripeSubscriptionId":         updated.StripeSubscriptionID,
			"subscriptionStatus":           updated.SubscriptionStatus,
			"subscriptionCurrentPeriodEnd": updated.SubscriptionCurrentPeriodEnd,
			"synced":                       true,
		})
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

// wrapWithSeed wraps a handler to automatically create seed data on first access
func wrapWithSeed(
	handler fiber.Handler,
	buildRepo *builds.Repository,
	conventionRepo *convention.Repository,
) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Try to create seed data (will skip if data already exists)
		deviceID := c.Get("x-kyar-device-id")
		if deviceID != "" {
			userID := ""
			if u := middleware.AppUser(c); u != nil {
				userID = u.ID
			}
			// Create seed data in background (don't block request)
			go func() {
				ctx := context.Background()
				_, _ = seed.CreateStarterData(ctx, deviceID, userID, buildRepo, conventionRepo)
			}()
		}
		return handler(c)
	}
}

// seedDataHandler manually triggers seed data creation (useful for testing/onboarding)
func seedDataHandler(
	buildRepo *builds.Repository,
	conventionRepo *convention.Repository,
) fiber.Handler {
	return func(c *fiber.Ctx) error {
		deviceID := c.Get("x-kyar-device-id")
		if deviceID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "x-kyar-device-id header required"})
		}

		userID := ""
		if u := middleware.AppUser(c); u != nil {
			userID = u.ID
		}

		created, err := seed.CreateStarterData(c.Context(), deviceID, userID, buildRepo, conventionRepo)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		if !created {
			return c.JSON(fiber.Map{
				"created": false,
				"message": "Seed data already exists or device has existing data",
			})
		}

		return c.Status(201).JSON(fiber.Map{
			"created": true,
			"message": "Starter build and convention created successfully",
		})
	}
}
