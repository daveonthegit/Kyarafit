package email

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"
	"os"
	"strconv"
	"strings"
)

// Client represents an email client
type Client struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

// NewClient creates a new email client from environment variables
func NewClient() (*Client, error) {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	username := os.Getenv("SMTP_USERNAME")
	password := os.Getenv("SMTP_PASSWORD")
	from := os.Getenv("SMTP_FROM")

	if host == "" || portStr == "" || username == "" || password == "" || from == "" {
		return nil, fmt.Errorf("SMTP configuration incomplete: ensure SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM are set")
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return nil, fmt.Errorf("invalid SMTP_PORT: %w", err)
	}

	return &Client{
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
		From:     from,
	}, nil
}

// Email represents an email message
type Email struct {
	To      []string
	Subject string
	Body    string
	IsHTML  bool
}

// Send sends an email
func (c *Client) Send(email Email) error {
	if len(email.To) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	// Build message
	var msg bytes.Buffer
	msg.WriteString(fmt.Sprintf("From: %s\r\n", c.From))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(email.To, ", ")))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", email.Subject))

	if email.IsHTML {
		msg.WriteString("MIME-Version: 1.0\r\n")
		msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	}

	msg.WriteString("\r\n")
	msg.WriteString(email.Body)

	// Connect to SMTP server
	addr := fmt.Sprintf("%s:%d", c.Host, c.Port)

	// Set up authentication
	auth := smtp.PlainAuth("", c.Username, c.Password, c.Host)

	// Try TLS connection first (for ports like 587)
	if c.Port == 587 || c.Port == 465 {
		return c.sendWithTLS(addr, auth, email.To, msg.Bytes())
	}

	// Fallback to plain SMTP (for port 25 or custom ports)
	return smtp.SendMail(addr, auth, c.From, email.To, msg.Bytes())
}

// sendWithTLS sends email using STARTTLS
func (c *Client) sendWithTLS(addr string, auth smtp.Auth, to []string, msg []byte) error {
	// Create TLS config
	tlsConfig := &tls.Config{
		ServerName: c.Host,
	}

	// Connect to server
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		// Try STARTTLS instead
		return smtp.SendMail(addr, auth, c.From, to, msg)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, c.Host)
	if err != nil {
		return err
	}
	defer func() { _ = client.Quit() }()

	// Authenticate
	if err = client.Auth(auth); err != nil {
		return err
	}

	// Set sender
	if err = client.Mail(c.From); err != nil {
		return err
	}

	// Set recipients
	for _, recipient := range to {
		if err = client.Rcpt(recipient); err != nil {
			return err
		}
	}

	// Send data
	w, err := client.Data()
	if err != nil {
		return err
	}
	defer w.Close()

	_, err = w.Write(msg)
	return err
}

// SendTemplate sends an email using a template
func (c *Client) SendTemplate(to []string, subject string, templateName string, data interface{}) error {
	tmpl, err := template.ParseFiles(fmt.Sprintf("templates/%s.html", templateName))
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}

	var body bytes.Buffer
	if err := tmpl.Execute(&body, data); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	return c.Send(Email{
		To:      to,
		Subject: subject,
		Body:    body.String(),
		IsHTML:  true,
	})
}

// Verify checks if the SMTP configuration is valid
func (c *Client) Verify() error {
	addr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	client, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}
	defer func() { _ = client.Quit() }()

	return nil
}
