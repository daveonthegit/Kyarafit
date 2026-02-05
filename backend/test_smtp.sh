#!/bin/bash

# SMTP Configuration Test Script
# This script tests your SMTP configuration

echo "=========================================="
echo "  Kyarafit SMTP Configuration Test"
echo "=========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    echo "✓ Found .env file"
    export $(grep -v '^#' .env | xargs)
else
    echo "✗ No .env file found!"
    echo "  Please create a .env file with SMTP configuration"
    exit 1
fi

# Check required variables
echo ""
echo "Checking SMTP configuration..."
echo ""

MISSING=0

if [ -z "$SMTP_HOST" ]; then
    echo "✗ SMTP_HOST is not set"
    MISSING=1
else
    echo "✓ SMTP_HOST: $SMTP_HOST"
fi

if [ -z "$SMTP_PORT" ]; then
    echo "✗ SMTP_PORT is not set"
    MISSING=1
else
    echo "✓ SMTP_PORT: $SMTP_PORT"
fi

if [ -z "$SMTP_USERNAME" ]; then
    echo "✗ SMTP_USERNAME is not set"
    MISSING=1
else
    echo "✓ SMTP_USERNAME: $SMTP_USERNAME"
fi

if [ -z "$SMTP_PASSWORD" ]; then
    echo "✗ SMTP_PASSWORD is not set"
    MISSING=1
else
    echo "✓ SMTP_PASSWORD: ********"
fi

if [ -z "$SMTP_FROM" ]; then
    echo "✗ SMTP_FROM is not set"
    MISSING=1
else
    echo "✓ SMTP_FROM: $SMTP_FROM"
fi

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "✗ SMTP configuration is incomplete!"
    echo ""
    echo "Please set the following in your .env file:"
    echo "  SMTP_HOST=smtp.gmail.com"
    echo "  SMTP_PORT=587"
    echo "  SMTP_USERNAME=your-email@gmail.com"
    echo "  SMTP_PASSWORD=your-app-password"
    echo "  SMTP_FROM=Kyarafit <noreply@kyarafit.com>"
    echo ""
    exit 1
fi

echo ""
echo "=========================================="
echo "All required SMTP variables are set!"
echo "=========================================="
echo ""

# Test connection
echo "Testing SMTP connection..."
echo ""

# Check if server is running
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "✗ Backend server is not running"
    echo ""
    echo "Start the server with:"
    echo "  go run main.go"
    echo ""
    echo "Or with Docker:"
    echo "  docker-compose up -d"
    echo ""
    exit 1
fi

echo "✓ Backend server is running"
echo ""

# Verify SMTP configuration
echo "Verifying SMTP configuration with server..."
VERIFY_RESPONSE=$(curl -s http://localhost:8080/api/test/email/verify)
echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
echo ""

# Check if configured
CONFIGURED=$(echo "$VERIFY_RESPONSE" | jq -r '.configured' 2>/dev/null)

if [ "$CONFIGURED" != "true" ]; then
    echo "✗ SMTP verification failed"
    echo ""
    echo "Please check your SMTP credentials and try again."
    echo "See SMTP_SETUP.md for detailed configuration guide."
    exit 1
fi

echo "✓ SMTP configuration verified!"
echo ""

# Send test email
echo "=========================================="
echo "Ready to send test email!"
echo "=========================================="
echo ""

read -p "Enter email address to send test email to: " TEST_EMAIL

if [ -z "$TEST_EMAIL" ]; then
    echo "No email address provided. Skipping test email."
    exit 0
fi

echo ""
echo "Sending test email to $TEST_EMAIL..."
echo ""

TEST_RESPONSE=$(curl -s -X POST http://localhost:8080/api/test/email \
    -H "Content-Type: application/json" \
    -d "{\"to\":\"$TEST_EMAIL\"}")

echo "$TEST_RESPONSE" | jq '.' 2>/dev/null || echo "$TEST_RESPONSE"
echo ""

SUCCESS=$(echo "$TEST_RESPONSE" | jq -r '.success' 2>/dev/null)

if [ "$SUCCESS" = "true" ]; then
    echo "=========================================="
    echo "✓ Test email sent successfully!"
    echo "=========================================="
    echo ""
    echo "Check your inbox at: $TEST_EMAIL"
    echo ""
    echo "If you don't see the email:"
    echo "1. Check your spam folder"
    echo "2. Wait a few minutes (SMTP delivery can be delayed)"
    echo "3. Verify the recipient email is correct"
    echo ""
else
    echo "✗ Failed to send test email"
    echo ""
    echo "Please check the error message above and your SMTP configuration."
    echo "See SMTP_SETUP.md for troubleshooting tips."
    exit 1
fi
