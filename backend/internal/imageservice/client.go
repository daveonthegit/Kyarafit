package imageservice

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultTimeout = 90 * time.Second
	maxBodySize    = 10 * 1024 * 1024 // 10MB
)

// Client calls the image-service for background removal.
type Client struct {
	baseURL string
	client  *http.Client
}

// NewClient returns a client that uses IMAGE_SERVICE_URL. Empty URL means disabled.
func NewClient() *Client {
	baseURL := strings.TrimSuffix(os.Getenv("IMAGE_SERVICE_URL"), "/")
	return &Client{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// Enabled returns true if IMAGE_SERVICE_URL is set.
func (c *Client) Enabled() bool {
	return c.baseURL != ""
}

// RemoveBackground sends image bytes to the image-service and returns PNG bytes.
func (c *Client) RemoveBackground(ctx context.Context, imageBytes []byte, contentType string) (pngBytes []byte, err error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("image service not configured")
	}
	url := c.baseURL + "/remove-bg"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(imageBytes))
	if err != nil {
		return nil, err
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	req.Header.Set("Content-Type", contentType)
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodySize+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxBodySize {
		return nil, fmt.Errorf("image service response too large")
	}
	if resp.StatusCode != http.StatusOK {
		var errBody struct {
			Detail string `json:"detail"`
		}
		_ = json.Unmarshal(body, &errBody)
		if errBody.Detail != "" {
			return nil, fmt.Errorf("image service %d: %s", resp.StatusCode, errBody.Detail)
		}
		return nil, fmt.Errorf("image service returned %d", resp.StatusCode)
	}
	return body, nil
}
