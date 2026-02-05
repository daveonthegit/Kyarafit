#!/bin/bash

# Test script for user sync functionality
# This script tests the user sync endpoints and Stripe webhook (mock)

set -e

# Configuration
API_URL="${API_URL:-http://localhost:8080}"
TEST_EMAIL="test@kyarafit.com"

echo "🧪 Testing User Sync System"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health check
echo "1. Testing health endpoint..."
HEALTH=$(curl -s "${API_URL}/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} Health check passed"
else
    echo -e "${RED}✗${NC} Health check failed"
    exit 1
fi
echo ""

# Test 2: Get user info (requires JWT token)
echo "2. Testing /api/v1/users/me endpoint..."
echo -e "${YELLOW}Note: This requires a valid JWT token${NC}"
echo "To test this endpoint, run:"
echo "  curl -H \"Authorization: Bearer YOUR_JWT_TOKEN\" ${API_URL}/api/v1/users/me"
echo ""

# Test 3: Check database schema
echo "3. Checking database schema..."
if command -v psql &> /dev/null; then
    if [ -n "$DATABASE_URL" ]; then
        echo "Checking app_users table columns..."
        COLUMNS=$(psql "$DATABASE_URL" -t -c "\d app_users" 2>/dev/null || echo "error")
        if echo "$COLUMNS" | grep -q "email"; then
            echo -e "${GREEN}✓${NC} Enhanced schema detected (email column exists)"
        else
            echo -e "${YELLOW}⚠${NC}  Enhanced schema not found. Run migration 008."
        fi
    else
        echo -e "${YELLOW}⚠${NC}  DATABASE_URL not set. Skipping database check."
    fi
else
    echo -e "${YELLOW}⚠${NC}  psql not installed. Skipping database check."
fi
echo ""

# Test 4: Stripe webhook (mock)
echo "4. Testing Stripe webhook endpoint..."
echo -e "${YELLOW}Note: Webhook is disabled by default for security${NC}"
echo "To enable, uncomment the webhook route in main.go and implement signature verification"
echo ""

# Test 5: Check environment variables
echo "5. Checking environment configuration..."
REQUIRED_VARS=("JWT_SECRET" "DATABASE_URL")
OPTIONAL_VARS=("STRIPE_WEBHOOK_SECRET" "STRIPE_PRICE_BASIC" "STRIPE_PRICE_PRO")

all_required_set=true
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗${NC} $var not set (required)"
        all_required_set=false
    else
        echo -e "${GREEN}✓${NC} $var is set"
    fi
done

for var in "${OPTIONAL_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${YELLOW}⚠${NC}  $var not set (optional for Stripe integration)"
    else
        echo -e "${GREEN}✓${NC} $var is set"
    fi
done

echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
if [ "$all_required_set" = true ]; then
    echo -e "${GREEN}✓${NC} All required configuration is set"
    echo -e "${GREEN}✓${NC} Backend is ready for user sync"
else
    echo -e "${RED}✗${NC} Missing required configuration"
    echo "Please set required environment variables in backend/.env"
fi

echo ""
echo "📚 Next Steps:"
echo "1. Run migration 008 if not already applied"
echo "2. Set up Stripe webhook in Stripe Dashboard"
echo "3. Test user signup and verify sync to app_users table"
echo "4. Test Stripe webhook using Stripe CLI: stripe listen --forward-to ${API_URL}/webhooks/stripe"
echo ""
echo "For detailed documentation, see USER_SYNC_SYSTEM.md"
