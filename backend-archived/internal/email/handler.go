package email

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

// TestEmailRequest represents a request to send a test email
type TestEmailRequest struct {
	To string `json:"to"`
}

// Handler provides HTTP handlers for email operations
type Handler struct {
	client *Client
}

// NewHandler creates a new email handler
func NewHandler(client *Client) *Handler {
	return &Handler{client: client}
}

// SendTestEmail sends a test email (for debugging/testing)
func (h *Handler) SendTestEmail(c *fiber.Ctx) error {
	var req TestEmailRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if req.To == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "Recipient email is required",
		})
	}

	// Send test email
	err := h.client.Send(Email{
		To:      []string{req.To},
		Subject: "Kyarafit SMTP Test",
		Body: `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>SMTP Test</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
	<h1 style="color: #667eea;">SMTP Configuration Test</h1>
	<p>If you're reading this, your SMTP configuration is working correctly! 🎉</p>
	<p>Kyarafit email service is ready to send emails.</p>
	<hr>
	<p style="color: #666; font-size: 12px;">This is a test email from Kyarafit Backend</p>
</body>
</html>
		`,
		IsHTML: true,
	})

	if err != nil {
		log.Printf("Failed to send test email: %v", err)
		return c.Status(500).JSON(fiber.Map{
			"error":   "Failed to send email",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Test email sent successfully",
		"to":      req.To,
	})
}

// VerifyConfiguration checks if SMTP is properly configured
func (h *Handler) VerifyConfiguration(c *fiber.Ctx) error {
	if h.client == nil {
		return c.Status(500).JSON(fiber.Map{
			"configured": false,
			"error":      "Email client not initialized",
		})
	}

	err := h.client.Verify()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{
			"configured": false,
			"error":      err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"configured": true,
		"host":       h.client.Host,
		"port":       h.client.Port,
		"from":       h.client.From,
	})
}
