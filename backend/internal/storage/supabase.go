package storage

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

// SupabaseStorage handles uploads to Supabase Storage.
type SupabaseStorage struct {
	supabaseURL string
	serviceKey  string
	bucketName  string
}

// NewSupabaseStorage creates a new Supabase Storage client.
func NewSupabaseStorage() *SupabaseStorage {
	return &SupabaseStorage{
		supabaseURL: os.Getenv("SUPABASE_URL"),
		serviceKey:  os.Getenv("SUPABASE_SERVICE_KEY"), // service_role key for backend uploads
		bucketName:  "kyarafit-images",
	}
}

// Upload uploads a file to Supabase Storage and returns the public URL.
// Path format: {userID}/{filename}
func (s *SupabaseStorage) Upload(userID string, filename string, file multipart.File) (string, error) {
	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}
	return s.UploadFromBytes(userID, filename, content)
}

// UploadFromBytes uploads content to Supabase Storage and returns the public URL.
func (s *SupabaseStorage) UploadFromBytes(userID string, filename string, content []byte) (string, error) {
	storagePath := fmt.Sprintf("%s/%s", userID, filename)
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.supabaseURL, s.bucketName, storagePath)
	req, err := http.NewRequest("POST", url, bytes.NewReader(content))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", detectContentType(filename))
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("upload failed: %s", string(body))
	}
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.supabaseURL, s.bucketName, storagePath)
	return publicURL, nil
}

// Delete removes a file from Supabase Storage.
func (s *SupabaseStorage) Delete(publicURL string) error {
	// Extract path from public URL
	// Format: https://.../storage/v1/object/public/closet-images/userID/filename
	// We need: closet-images/userID/filename

	// For now, stub - implement path extraction
	return nil
}

func detectContentType(filename string) string {
	ext := filepath.Ext(filename)
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	default:
		return "application/octet-stream"
	}
}

// UploadResponse is the response from Supabase Storage upload.
type UploadResponse struct {
	Key string `json:"Key"`
}
