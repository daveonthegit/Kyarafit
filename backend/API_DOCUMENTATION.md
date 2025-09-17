# Kyarafit Backend API Documentation

## Table of Contents
- [Pieces API Endpoints](#pieces-api-endpoints)
- [Builds API Endpoints](#builds-api-endpoints)
- [Error Responses](#error-responses)
- [Data Models](#data-models)
- [Testing](#testing)

---

## Pieces API Endpoints

The Pieces API provides CRUD operations for managing costume pieces, wigs, props, and accessories in the Kyarafit application.

### Base URL
```
http://localhost:8080/api/v1
```

### Authentication
All endpoints require JWT authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Get All Pieces
**GET** `/pieces`

Retrieves all pieces for the authenticated user with optional filtering and pagination.

#### Query Parameters
- `limit` (optional): Number of pieces to return (default: 20, max: 100)
- `offset` (optional): Number of pieces to skip (default: 0)
- `category` (optional): Filter by category (e.g., "wig", "dress", "prop")
- `search` (optional): Search in name, description, category, or tags

#### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/pieces?limit=10&category=wig&search=cosplay"
```

#### Response
```json
{
  "pieces": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "Anime Wig",
      "description": "Beautiful pink anime wig",
      "image_url": "https://example.com/wig.jpg",
      "thumbnail_url": "https://example.com/wig_thumb.jpg",
      "category": "wig",
      "tags": ["anime", "pink", "cosplay"],
      "source_link": "https://shop.example.com/wig",
      "purchase_date": "2024-01-15T00:00:00Z",
      "price": 25.99,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total_count": 1,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Create Piece
**POST** `/pieces`

Creates a new piece for the authenticated user.

#### Request Body
```json
{
  "name": "string (required, max 255 chars)",
  "description": "string (optional, max 1000 chars)",
  "image_url": "string (optional, valid URL)",
  "thumbnail_url": "string (optional, valid URL)",
  "category": "string (optional, max 100 chars)",
  "tags": ["string"] (optional array),
  "source_link": "string (optional, valid URL)",
  "purchase_date": "string (optional, YYYY-MM-DD format)",
  "price": "number (optional, min 0)"
}
```

#### Example Request
```bash
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Wig",
       "description": "A beautiful test wig",
       "category": "wig",
       "tags": ["test", "cosplay"],
       "price": 25.99,
       "purchase_date": "2024-01-15"
     }' \
     "http://localhost:8080/api/v1/pieces"
```

#### Response
```json
{
  "message": "Piece created successfully",
  "piece": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Test Wig",
    "description": "A beautiful test wig",
    "category": "wig",
    "tags": ["test", "cosplay"],
    "price": 25.99,
    "purchase_date": "2024-01-15T00:00:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 3. Get Piece by ID
**GET** `/pieces/{id}`

Retrieves a specific piece by its ID.

#### Path Parameters
- `id`: UUID of the piece

#### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/pieces/123e4567-e89b-12d3-a456-426614174000"
```

#### Response
```json
{
  "piece": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Test Wig",
    "description": "A beautiful test wig",
    "image_url": "https://example.com/wig.jpg",
    "thumbnail_url": "https://example.com/wig_thumb.jpg",
    "category": "wig",
    "tags": ["test", "cosplay"],
    "source_link": "https://shop.example.com/wig",
    "purchase_date": "2024-01-15T00:00:00Z",
    "price": 25.99,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Update Piece
**PUT** `/pieces/{id}`

Updates an existing piece. All fields are optional.

#### Path Parameters
- `id`: UUID of the piece

#### Request Body
```json
{
  "name": "string (optional, max 255 chars)",
  "description": "string (optional, max 1000 chars)",
  "image_url": "string (optional, valid URL)",
  "thumbnail_url": "string (optional, valid URL)",
  "category": "string (optional, max 100 chars)",
  "tags": ["string"] (optional array),
  "source_link": "string (optional, valid URL)",
  "purchase_date": "string (optional, YYYY-MM-DD format)",
  "price": "number (optional, min 0)"
}
```

#### Example Request
```bash
curl -X PUT \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Updated Wig Name",
       "price": 29.99
     }' \
     "http://localhost:8080/api/v1/pieces/123e4567-e89b-12d3-a456-426614174000"
```

#### Response
```json
{
  "message": "Piece updated successfully",
  "piece": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Updated Wig Name",
    "description": "A beautiful test wig",
    "category": "wig",
    "tags": ["test", "cosplay"],
    "price": 29.99,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### 5. Delete Piece
**DELETE** `/pieces/{id}`

Deletes a piece by its ID.

#### Path Parameters
- `id`: UUID of the piece

#### Example Request
```bash
curl -X DELETE \
     -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/pieces/123e4567-e89b-12d3-a456-426614174000"
```

#### Response
```json
{
  "message": "Piece deleted successfully"
}
```

---

### 6. Get Categories
**GET** `/pieces/categories`

Retrieves all available categories for pieces.

#### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/pieces/categories"
```

#### Response
```json
{
  "categories": [
    "wig",
    "dress",
    "prop",
    "shoes",
    "accessory",
    "makeup",
    "other"
  ]
}
```

---

## Builds API Endpoints

The Builds API provides CRUD operations for managing cosplay build projects, including tracking progress, budgets, and deadlines.

### Base URL
```
http://localhost:8080/api/v1
```

### Authentication
All endpoints require JWT authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Get All Builds
**GET** `/builds`

Retrieves all builds for the authenticated user with optional filtering and pagination.

#### Query Parameters
- `limit` (optional): Number of builds to return (default: 20, max: 100)
- `offset` (optional): Number of builds to skip (default: 0)
- `status` (optional): Filter by status (idea, sourcing, wip, complete, on_hold, cancelled)
- `priority` (optional): Filter by priority (1-5)
- `search` (optional): Search in name, description, character, or series
- `upcoming` (optional): Get builds with target dates within N days (default: 30)

#### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/builds?limit=10&status=wip&priority=3"
```

#### Response
```json
{
  "builds": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "user_id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "Anime Character Cosplay",
      "description": "Complete cosplay build for anime character",
      "character": "Sakura",
      "series": "Naruto",
      "status": "wip",
      "priority": 3,
      "budget": 200.00,
      "spent": 75.50,
      "start_date": "2024-01-15T00:00:00Z",
      "target_date": "2024-06-15T00:00:00Z",
      "completed_date": null,
      "tags": ["anime", "cosplay", "wip"],
      "notes": "Working on the costume pieces",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total_count": 1,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Create Build
**POST** `/builds`

Creates a new build for the authenticated user.

#### Request Body
```json
{
  "name": "string (required, max 255 chars)",
  "description": "string (optional, max 1000 chars)",
  "character": "string (optional, max 255 chars)",
  "series": "string (optional, max 255 chars)",
  "status": "string (optional, one of: idea, sourcing, wip, complete, on_hold, cancelled)",
  "priority": "number (optional, 1-5 scale)",
  "budget": "number (optional, min 0)",
  "spent": "number (optional, min 0)",
  "start_date": "string (optional, YYYY-MM-DD format)",
  "target_date": "string (optional, YYYY-MM-DD format)",
  "tags": ["string"] (optional array),
  "notes": "string (optional, max 2000 chars)"
}
```

#### Example Request
```bash
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Cosplay Build",
       "description": "A beautiful test cosplay build",
       "character": "Test Character",
       "series": "Test Series",
       "status": "idea",
       "priority": 3,
       "budget": 150.00,
       "start_date": "2024-01-15",
       "target_date": "2024-06-15",
       "tags": ["test", "cosplay"],
       "notes": "This is a test build"
     }' \
     "http://localhost:8080/api/v1/builds"
```

#### Response
```json
{
  "message": "Build created successfully",
  "build": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Test Cosplay Build",
    "description": "A beautiful test cosplay build",
    "character": "Test Character",
    "series": "Test Series",
    "status": "idea",
    "priority": 3,
    "budget": 150.00,
    "spent": 0.00,
    "start_date": "2024-01-15T00:00:00Z",
    "target_date": "2024-06-15T00:00:00Z",
    "completed_date": null,
    "tags": ["test", "cosplay"],
    "notes": "This is a test build",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 3. Get Build by ID
**GET** `/builds/{id}`

Retrieves a specific build by its ID.

#### Path Parameters
- `id`: UUID of the build

#### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/builds/123e4567-e89b-12d3-a456-426614174000"
```

#### Response
```json
{
  "build": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Test Cosplay Build",
    "description": "A beautiful test cosplay build",
    "character": "Test Character",
    "series": "Test Series",
    "status": "idea",
    "priority": 3,
    "budget": 150.00,
    "spent": 0.00,
    "start_date": "2024-01-15T00:00:00Z",
    "target_date": "2024-06-15T00:00:00Z",
    "completed_date": null,
    "tags": ["test", "cosplay"],
    "notes": "This is a test build",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 4. Update Build
**PUT** `/builds/{id}`

Updates an existing build. All fields are optional.

#### Path Parameters
- `id`: UUID of the build

#### Request Body
```json
{
  "name": "string (optional, max 255 chars)",
  "description": "string (optional, max 1000 chars)",
  "character": "string (optional, max 255 chars)",
  "series": "string (optional, max 255 chars)",
  "status": "string (optional, one of: idea, sourcing, wip, complete, on_hold, cancelled)",
  "priority": "number (optional, 1-5 scale)",
  "budget": "number (optional, min 0)",
  "spent": "number (optional, min 0)",
  "start_date": "string (optional, YYYY-MM-DD format)",
  "target_date": "string (optional, YYYY-MM-DD format)",
  "completed_date": "string (optional, YYYY-MM-DD format)",
  "tags": ["string"] (optional array),
  "notes": "string (optional, max 2000 chars)"
}
```

#### Example Request
```bash
curl -X PUT \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "status": "wip",
       "spent": 25.50,
       "notes": "Started working on the costume"
     }' \
     "http://localhost:8080/api/v1/builds/123e4567-e89b-12d3-a456-426614174000"
```

#### Response
```json
{
  "message": "Build updated successfully",
  "build": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "Test Cosplay Build",
    "description": "A beautiful test cosplay build",
    "character": "Test Character",
    "series": "Test Series",
    "status": "wip",
    "priority": 3,
    "budget": 150.00,
    "spent": 25.50,
    "start_date": "2024-01-15T00:00:00Z",
    "target_date": "2024-06-15T00:00:00Z",
    "completed_date": null,
    "tags": ["test", "cosplay"],
    "notes": "Started working on the costume",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### 5. Delete Build
**DELETE** `/builds/{id}`

Deletes a build by its ID.

#### Path Parameters
- `id`: UUID of the build

#### Example Request
```bash
curl -X DELETE \
     -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/builds/123e4567-e89b-12d3-a456-426614174000"
```

#### Response
```json
{
  "message": "Build deleted successfully"
}
```

---

### 6. Get Build Statistics
**GET** `/builds/stats`

Retrieves build statistics for the authenticated user.

#### Example Request
```bash
curl -H "Authorization: Bearer <token>" \
     "http://localhost:8080/api/v1/builds/stats"
```

#### Response
```json
{
  "total_builds": 5,
  "by_status": {
    "idea": 2,
    "sourcing": 1,
    "wip": 1,
    "complete": 1,
    "on_hold": 0,
    "cancelled": 0
  },
  "upcoming_builds": 2
}
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "User not authenticated"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Piece not found"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid request body"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to create piece"
}
```

---

## Data Models

### Piece
```typescript
interface Piece {
  id: string;                    // UUID
  user_id: string;              // UUID of the owner
  name: string;                 // Required, max 255 chars
  description?: string;         // Optional, max 1000 chars
  image_url?: string;           // Optional, valid URL
  thumbnail_url?: string;       // Optional, valid URL
  category?: string;            // Optional, max 100 chars
  tags?: string[];              // Optional array of strings
  source_link?: string;         // Optional, valid URL
  purchase_date?: string;       // Optional, ISO date string
  price?: number;               // Optional, min 0
  created_at: string;           // ISO timestamp
  updated_at: string;           // ISO timestamp
}
```

### Build
```typescript
interface Build {
  id: string;                    // UUID
  user_id: string;              // UUID of the owner
  name: string;                 // Required, max 255 chars
  description?: string;         // Optional, max 1000 chars
  character?: string;           // Optional, max 255 chars
  series?: string;              // Optional, max 255 chars
  status: BuildStatus;          // Required, enum: idea, sourcing, wip, complete, on_hold, cancelled
  priority?: number;            // Optional, 1-5 scale
  budget?: number;              // Optional, min 0
  spent?: number;               // Optional, min 0
  start_date?: string;          // Optional, ISO date string
  target_date?: string;         // Optional, ISO date string
  completed_date?: string;      // Optional, ISO date string
  tags?: string[];              // Optional array of strings
  notes?: string;               // Optional, max 2000 chars
  created_at: string;           // ISO timestamp
  updated_at: string;           // ISO timestamp
}

type BuildStatus = "idea" | "sourcing" | "wip" | "complete" | "on_hold" | "cancelled";
```

---

## Testing

Use the provided test scripts to test the API endpoints:

### Pieces API Testing
```bash
# Make the script executable
chmod +x test_pieces_api.sh

# Run the tests (requires valid JWT token)
./test_pieces_api.sh
```

### Builds API Testing
```bash
# Make the script executable
chmod +x test_builds_api.sh

# Run the tests (requires valid JWT token)
./test_builds_api.sh
```

**Note**: To test with real data, you need to:
1. Set up authentication and get a valid JWT token
2. Replace `JWT_TOKEN` in the test scripts with the actual token
3. Run the scripts again
