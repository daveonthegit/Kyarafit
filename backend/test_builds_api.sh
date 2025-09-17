#!/bin/bash

# Test script for Builds CRUD API endpoints
# Note: This requires a valid JWT token for authentication

BASE_URL="http://localhost:8080/api/v1"
JWT_TOKEN="your-jwt-token-here"  # Replace with actual JWT token

echo "Testing Builds CRUD API endpoints..."
echo "====================================="

# Test 1: Get all builds (requires authentication)
echo -e "\n1. Testing GET /builds (requires auth)"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/builds" | jq '.'

# Test 2: Create a new build (requires authentication)
echo -e "\n2. Testing POST /builds (create build)"
BUILD_DATA='{
  "name": "Test Cosplay Build",
  "description": "A beautiful test cosplay build",
  "character": "Test Character",
  "series": "Test Series",
  "status": "idea",
  "priority": 3,
  "budget": 150.00,
  "spent": 0.00,
  "start_date": "2024-01-15",
  "target_date": "2024-06-15",
  "tags": ["test", "cosplay", "build"],
  "notes": "This is a test build for API testing"
}'

curl -s -X POST \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d "$BUILD_DATA" \
     "$BASE_URL/builds" | jq '.'

# Test 3: Get build statistics
echo -e "\n3. Testing GET /builds/stats"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/builds/stats" | jq '.'

# Test 4: Search builds
echo -e "\n4. Testing GET /builds?search=test"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/builds?search=test" | jq '.'

# Test 5: Get builds by status
echo -e "\n5. Testing GET /builds?status=idea"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/builds?status=idea" | jq '.'

# Test 6: Get builds by priority
echo -e "\n6. Testing GET /builds?priority=3"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/builds?priority=3" | jq '.'

# Test 7: Get upcoming builds
echo -e "\n7. Testing GET /builds?upcoming=30"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/builds?upcoming=30" | jq '.'

echo -e "\n====================================="
echo "API testing completed!"
echo "Note: To test with real data, you need to:"
echo "1. Set up authentication and get a valid JWT token"
echo "2. Replace JWT_TOKEN in this script with the actual token"
echo "3. Run the script again"
