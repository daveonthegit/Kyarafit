package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// JWTConfig holds the JWT configuration
type JWTConfig struct {
	Secret string
}

// NewJWTMiddleware creates a new JWT middleware
func NewJWTMiddleware(config JWTConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get the Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "Authorization header required",
			})
		}

		// Check if it starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid authorization header format",
			})
		}

		// Extract the token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(401, "Invalid signing method")
			}
			return []byte(config.Secret), nil
		})

		if err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid token",
			})
		}

		// Check if the token is valid
		if !token.Valid {
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid token",
			})
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid token claims",
			})
		}

		// Extract user ID from claims
		userID, ok := claims["sub"].(string)
		if !ok {
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid user ID in token",
			})
		}

		// Store user ID in context
		c.Locals("userID", userID)

		return c.Next()
	}
}

// OptionalJWTMiddleware creates a JWT middleware that doesn't require authentication
func OptionalJWTMiddleware(config JWTConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get the Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Next()
		}

		// Check if it starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Next()
		}

		// Extract the token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(401, "Invalid signing method")
			}
			return []byte(config.Secret), nil
		})

		if err != nil {
			return c.Next()
		}

		// Check if the token is valid
		if !token.Valid {
			return c.Next()
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Next()
		}

		// Extract user ID from claims
		userID, ok := claims["sub"].(string)
		if !ok {
			return c.Next()
		}

		// Store user ID in context
		c.Locals("userID", userID)

		return c.Next()
	}
}
