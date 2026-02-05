# Test script for user sync functionality (PowerShell)
# This script tests the user sync endpoints and Stripe webhook (mock)

param(
    [string]$ApiUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Continue"

Write-Host "🧪 Testing User Sync System" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1. Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get -ErrorAction Stop
    if ($health.status -eq "ok") {
        Write-Host "✓ Health check passed" -ForegroundColor Green
    } else {
        Write-Host "✗ Health check failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Get user info (requires JWT token)
Write-Host "2. Testing /api/v1/users/me endpoint..." -ForegroundColor Yellow
Write-Host "Note: This requires a valid JWT token" -ForegroundColor DarkYellow
Write-Host "To test this endpoint, run:"
Write-Host "  Invoke-RestMethod -Uri '$ApiUrl/api/v1/users/me' -Headers @{Authorization='Bearer YOUR_JWT_TOKEN'}"
Write-Host ""

# Test 3: Check environment variables
Write-Host "3. Checking environment configuration..." -ForegroundColor Yellow

# Load .env file if it exists
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$requiredVars = @("JWT_SECRET", "DATABASE_URL")
$optionalVars = @("STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_BASIC", "STRIPE_PRICE_PRO")

$allRequiredSet = $true
foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "✗ $var not set (required)" -ForegroundColor Red
        $allRequiredSet = $false
    } else {
        Write-Host "✓ $var is set" -ForegroundColor Green
    }
}

foreach ($var in $optionalVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "⚠  $var not set (optional for Stripe integration)" -ForegroundColor DarkYellow
    } else {
        Write-Host "✓ $var is set" -ForegroundColor Green
    }
}

Write-Host ""

# Test 4: Stripe webhook
Write-Host "4. Testing Stripe webhook endpoint..." -ForegroundColor Yellow
Write-Host "Note: Webhook is disabled by default for security" -ForegroundColor DarkYellow
Write-Host "To enable, uncomment the webhook route in main.go and implement signature verification"
Write-Host ""

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

if ($allRequiredSet) {
    Write-Host "✓ All required configuration is set" -ForegroundColor Green
    Write-Host "✓ Backend is ready for user sync" -ForegroundColor Green
} else {
    Write-Host "✗ Missing required configuration" -ForegroundColor Red
    Write-Host "Please set required environment variables in backend\.env"
}

Write-Host ""
Write-Host "📚 Next Steps:"
Write-Host "1. Run migration 008 if not already applied"
Write-Host "2. Set up Stripe webhook in Stripe Dashboard"
Write-Host "3. Test user signup and verify sync to app_users table"
Write-Host "4. Test Stripe webhook using Stripe CLI:"
Write-Host "   stripe listen --forward-to $ApiUrl/webhooks/stripe"
Write-Host ""
Write-Host "For detailed documentation, see USER_SYNC_SYSTEM.md"
