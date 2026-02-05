package middleware

import (
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// AuthError represents a structured authentication error
type AuthError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// JWTConfig holds the JWT configuration
type JWTConfig struct {
	Secret    string // For HMAC (legacy)
	PublicKey string // For ECDSA (modern, PEM format)
}

// NewJWTMiddleware creates a new JWT middleware
func NewJWTMiddleware(config JWTConfig) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Get the Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			log.Printf("Auth failed: Missing Authorization header from %s", c.IP())
			return c.Status(401).JSON(AuthError{
				Code:    "missing_auth_header",
				Message: "Authorization header is required. Please include 'Authorization: Bearer <token>' in your request.",
			})
		}

		// Check if it starts with "Bearer "
		if !strings.HasPrefix(authHeader, "Bearer ") {
			log.Printf("Auth failed: Invalid format (not Bearer) from %s", c.IP())
			return c.Status(401).JSON(AuthError{
				Code:    "invalid_auth_format",
				Message: "Authorization header must use Bearer token format: 'Authorization: Bearer <token>'",
			})
		}

		// Extract the token
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if len(tokenString) == 0 {
			log.Printf("Auth failed: Empty token from %s", c.IP())
			return c.Status(401).JSON(AuthError{
				Code:    "missing_token",
				Message: "Bearer token is empty. Please provide a valid JWT token.",
			})
		}

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Support both HMAC (legacy) and ECDSA (modern)
			switch token.Method.(type) {
			case *jwt.SigningMethodHMAC:
				// Legacy HS256 validation
				if config.Secret == "" {
					return nil, fiber.NewError(401, "HMAC secret not configured")
				}
				return []byte(config.Secret), nil
			case *jwt.SigningMethodECDSA:
				// Modern ES256 validation
				if config.PublicKey == "" {
					return nil, fiber.NewError(401, "ECDSA public key not configured")
				}
				// Parse the PEM-encoded public key
				return parseECDSAPublicKey(config.PublicKey)
			default:
				return nil, fiber.NewError(401, "Unsupported signing method")
			}
		})

		if err != nil {
			// Check if token is expired
			if strings.Contains(err.Error(), "token is expired") {
				log.Printf("Auth failed: Expired token from %s", c.IP())
				return c.Status(401).JSON(AuthError{
					Code:    "expired_token",
					Message: "Your session has expired. Please sign in again.",
				})
			}
			log.Printf("Auth failed: Token parse error from %s: %v", c.IP(), err)
			return c.Status(401).JSON(AuthError{
				Code:    "invalid_token",
				Message: "Invalid or malformed JWT token. Please sign in again.",
			})
		}

		// Check if the token is valid
		if !token.Valid {
			log.Printf("Auth failed: Invalid token from %s", c.IP())
			return c.Status(401).JSON(AuthError{
				Code:    "invalid_token",
				Message: "Token validation failed. Please sign in again.",
			})
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Printf("Auth failed: Cannot extract claims from %s", c.IP())
			return c.Status(401).JSON(AuthError{
				Code:    "invalid_claims",
				Message: "Token claims are invalid. Please sign in again.",
			})
		}

		// Extract user ID from claims
		userID, ok := claims["sub"].(string)
		if !ok {
			log.Printf("Auth failed: Missing or invalid 'sub' claim from %s", c.IP())
			return c.Status(401).JSON(AuthError{
				Code:    "invalid_user_id",
				Message: "Token does not contain a valid user ID. Please sign in again.",
			})
		}

		// Store user ID in context
		c.Locals("userID", userID)

		return c.Next()
	}
}

// parseECDSAPublicKey parses a PEM-encoded ECDSA public key
func parseECDSAPublicKey(pemStr string) (*ecdsa.PublicKey, error) {
	// Replace escaped newlines with actual newlines (for env vars)
	pemStr = strings.ReplaceAll(pemStr, "\\n", "\n")

	// Try PEM format first
	block, _ := pem.Decode([]byte(pemStr))
	if block != nil {
		pub, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		ecdsaPub, ok := pub.(*ecdsa.PublicKey)
		if !ok {
			return nil, fiber.NewError(401, "Not an ECDSA public key")
		}
		return ecdsaPub, nil
	}

	// Try base64-encoded DER format
	der, err := base64.StdEncoding.DecodeString(pemStr)
	if err != nil {
		return nil, err
	}
	pub, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, err
	}
	ecdsaPub, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		return nil, fiber.NewError(401, "Not an ECDSA public key")
	}
	return ecdsaPub, nil
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
			// Support both HMAC (legacy) and ECDSA (modern)
			switch token.Method.(type) {
			case *jwt.SigningMethodHMAC:
				if config.Secret == "" {
					return nil, fiber.NewError(401, "HMAC secret not configured")
				}
				return []byte(config.Secret), nil
			case *jwt.SigningMethodECDSA:
				if config.PublicKey == "" {
					return nil, fiber.NewError(401, "ECDSA public key not configured")
				}
				return parseECDSAPublicKey(config.PublicKey)
			default:
				return nil, fiber.NewError(401, "Unsupported signing method")
			}
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
