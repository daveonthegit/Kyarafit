package closet

// Item is a closet item returned by the mock API.
type Item struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Category string   `json:"category"`
	ImageURL string   `json:"imageUrl"`
	Tags     []string `json:"tags"`
}
