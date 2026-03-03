#!/bin/bash

# Test script for Pieces CRUD API endpoints
# Note: This requires a valid JWT token for authentication

BASE_URL="http://localhost:8080/api/v1"
JWT_TOKEN="your-jwt-token-here"  # Replace with actual JWT token

echo "Testing Pieces CRUD API endpoints..."
echo "======================================"

# Test 1: Get all pieces (requires authentication)
echo -e "\n1. Testing GET /pieces (requires auth)"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/pieces" | jq '.'

# Test 2: Create a new piece (requires authentication)
echo -e "\n2. Testing POST /pieces (create piece)"
PIECE_DATA='{
  "name": "Test Wig",
  "description": "A beautiful test wig for cosplay",
  "category": "wig",
  "tags": ["test", "cosplay", "wig"],
  "price": 25.99,
  "purchase_date": "2024-01-15"
}'

curl -s -X POST \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d "$PIECE_DATA" \
     "$BASE_URL/pieces" | jq '.'

# Test 3: Get categories
echo -e "\n3. Testing GET /pieces/categories"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/pieces/categories" | jq '.'

# Test 4: Search pieces
echo -e "\n4. Testing GET /pieces?search=test"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/pieces?search=test" | jq '.'

# Test 5: Get pieces by category
echo -e "\n5. Testing GET /pieces?category=wig"
curl -s -H "Authorization: Bearer $JWT_TOKEN" \
     -H "Content-Type: application/json" \
     "$BASE_URL/pieces?category=wig" | jq '.'

echo -e "\n======================================"
echo "API testing completed!"
echo "Note: To test with real data, you need to:"
echo "1. Set up authentication and get a valid JWT token"
echo "2. Replace JWT_TOKEN in this script with the actual token"
echo "3. Run the script again"
