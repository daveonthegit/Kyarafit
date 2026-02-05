package middleware

import (
	"kyarafit-backend/internal/appuser"
	"kyarafit-backend/internal/tier"

	"github.com/gofiber/fiber/v2"
)

// RequireWebAccess requires JWT, loads app user (get or create), and ensures tier allows web access.
// Use for /api/v1 (web editor). Returns 401 with "Sign in required to use web editor." if no/invalid token or tier < FREE.
func RequireWebAccess(jwtCfg JWTConfig, userRepo *appuser.Repository) fiber.Handler {
	jwt := NewJWTMiddleware(jwtCfg)
	return func(c *fiber.Ctx) error {
		if err := jwt(c); err != nil {
			return err
		}
		userID, _ := c.Locals("userID").(string)
		if userID == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "Sign in required to use web editor.",
			})
		}
		u, err := userRepo.GetOrCreate(c.Context(), userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		if u == nil || !tier.Can(u, "web_access") {
			return c.Status(401).JSON(fiber.Map{
				"error": "Sign in required to use web editor.",
			})
		}
		c.Locals("appUser", u)
		return c.Next()
	}
}

// OptionalAppUser runs optional JWT and, if present, loads app user and sets c.Locals("appUser").
// Use for device-scoped routes so handlers can enforce limits and set user_id when authenticated.
func OptionalAppUser(jwtCfg JWTConfig, userRepo *appuser.Repository) fiber.Handler {
	optJWT := OptionalJWTMiddleware(jwtCfg)
	return func(c *fiber.Ctx) error {
		if err := optJWT(c); err != nil {
			return err
		}
		userID, ok := c.Locals("userID").(string)
		if !ok || userID == "" {
			return c.Next()
		}
		u, err := userRepo.GetOrCreate(c.Context(), userID)
		if err != nil {
			return c.Next() // don't fail device requests on user load error
		}
		if u != nil {
			c.Locals("appUser", u)
		}
		return c.Next()
	}
}

// ClientHeader is the header used to distinguish web vs mobile (sync).
const ClientHeader = "x-kyar-client"

// AllowSyncWrite returns nil to continue, or sends 403 and returns error.
// When user is present and client is "mobile", tier must be >= PREMIUM_BASIC.
// When user is present and client is "web" (or unset), FREE is allowed (limits enforced in handlers).
func AllowSyncWrite(c *fiber.Ctx) error {
	u, _ := c.Locals("appUser").(*tier.User)
	if u == nil {
		return nil
	}
	if c.Get(ClientHeader) != "mobile" {
		return nil
	}
	if !tier.AtLeast(u, tier.PREMIUM_BASIC) {
		return c.Status(403).JSON(fiber.Map{
			"error": "Upgrade to Premium to sync across devices and back up online.",
		})
	}
	return nil
}

// AppUser returns the app user from context, or nil.
func AppUser(c *fiber.Ctx) *tier.User {
	u, _ := c.Locals("appUser").(*tier.User)
	return u
}
