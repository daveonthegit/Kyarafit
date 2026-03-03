#!/bin/bash

# Authentication Testing Script
# Tests auth endpoints and token validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
TEST_TOKEN="${TEST_TOKEN:-}"

echo "=========================================="
echo "Kyarafit Authentication Test Suite"
echo "=========================================="
echo ""
echo "Backend URL: $BACKEND_URL"
echo ""

# Test counter
PASSED=0
FAILED=0

# Helper function to print test results
print_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    
    if [ "$expected" = "$actual" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name (expected: $expected, got: $actual)"
        ((FAILED++))
    fi
}

# Test 1: Health check (no auth required)
echo "Test 1: Health check (no auth required)"
echo "=========================================="
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
print_result "Health check returns 200" "200" "$HEALTH_STATUS"
echo ""

# Test 2: Auth endpoint without token (should return 401)
echo "Test 2: Auth endpoint without token"
echo "=========================================="
NO_TOKEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/v1/auth/me")
print_result "Auth endpoint without token returns 401" "401" "$NO_TOKEN_STATUS"

NO_TOKEN_RESPONSE=$(curl -s "$BACKEND_URL/api/v1/auth/me")
if echo "$NO_TOKEN_RESPONSE" | grep -q "missing_auth_header"; then
    echo -e "${GREEN}✓ PASS${NC}: Returns correct error code (missing_auth_header)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Incorrect error code in response"
    echo "Response: $NO_TOKEN_RESPONSE"
    ((FAILED++))
fi
echo ""

# Test 3: Auth endpoint with invalid token (should return 401)
echo "Test 3: Auth endpoint with invalid token"
echo "=========================================="
INVALID_TOKEN="invalid.token.here"
INVALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $INVALID_TOKEN" \
    "$BACKEND_URL/api/v1/auth/me")
print_result "Invalid token returns 401" "401" "$INVALID_STATUS"

INVALID_RESPONSE=$(curl -s \
    -H "Authorization: Bearer $INVALID_TOKEN" \
    "$BACKEND_URL/api/v1/auth/me")
if echo "$INVALID_RESPONSE" | grep -q "invalid_token"; then
    echo -e "${GREEN}✓ PASS${NC}: Returns correct error code (invalid_token)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: Incorrect error code in response"
    echo "Response: $INVALID_RESPONSE"
    ((FAILED++))
fi
echo ""

# Test 4: Auth endpoint with valid token (if provided)
if [ -n "$TEST_TOKEN" ]; then
    echo "Test 4: Auth endpoint with valid token"
    echo "=========================================="
    VALID_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        "$BACKEND_URL/api/v1/auth/me")
    print_result "Valid token returns 200" "200" "$VALID_STATUS"
    
    VALID_RESPONSE=$(curl -s \
        -H "Authorization: Bearer $TEST_TOKEN" \
        "$BACKEND_URL/api/v1/auth/me")
    
    if echo "$VALID_RESPONSE" | grep -q "authenticated"; then
        echo -e "${GREEN}✓ PASS${NC}: Response contains 'authenticated' field"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: Response missing 'authenticated' field"
        echo "Response: $VALID_RESPONSE"
        ((FAILED++))
    fi
    
    if echo "$VALID_RESPONSE" | grep -q "userId"; then
        echo -e "${GREEN}✓ PASS${NC}: Response contains 'userId' field"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: Response missing 'userId' field"
        echo "Response: $VALID_RESPONSE"
        ((FAILED++))
    fi
    
    echo ""
    echo "User info:"
    echo "$VALID_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VALID_RESPONSE"
    echo ""
    
    # Test 5: Sync endpoint with valid token
    echo "Test 5: Sync pull endpoint with valid token"
    echo "=========================================="
    SYNC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -H "x-kyar-device-id: test-device" \
        -H "x-kyar-client: web" \
        "$BACKEND_URL/api/v1/sync/pull")
    
    if [ "$SYNC_STATUS" = "200" ] || [ "$SYNC_STATUS" = "403" ]; then
        echo -e "${GREEN}✓ PASS${NC}: Sync endpoint returns $SYNC_STATUS (auth successful, may be tier restricted)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: Sync endpoint returns $SYNC_STATUS (expected 200 or 403)"
        ((FAILED++))
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ SKIP${NC}: Tests 4-5 skipped (no TEST_TOKEN provided)"
    echo ""
    echo "To test with a valid token:"
    echo "1. Sign in to the web app"
    echo "2. Get token from browser console"
    echo "3. Run: TEST_TOKEN='your-token' bash test_auth.sh"
    echo ""
fi

# Test 6: CORS preflight
echo "Test 6: CORS preflight (OPTIONS)"
echo "=========================================="
CORS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X OPTIONS \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: GET" \
    "$BACKEND_URL/api/v1/auth/me")

if [ "$CORS_STATUS" = "204" ] || [ "$CORS_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ PASS${NC}: CORS preflight returns $CORS_STATUS"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: CORS preflight returns $CORS_STATUS (expected 204 or 200)"
    ((FAILED++))
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
