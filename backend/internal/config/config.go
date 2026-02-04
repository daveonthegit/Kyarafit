package config

import "os"

// Port returns the server port (default 8080).
func Port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}
