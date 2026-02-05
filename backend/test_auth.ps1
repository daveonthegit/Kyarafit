# Authentication Testing Script (PowerShell)
# Tests auth endpoints and token validation

$ErrorActionPreference = "Stop"

# Configuration
$BACKEND_URL = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "http://localhost:8080" }
$TEST_TOKEN = if ($env:TEST_TOKEN) { $env:TEST_TOKEN } else { "" }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Kyarafit Authentication Test Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend URL: $BACKEND_URL"
Write-Host ""

# Test counter
$PASSED = 0
$FAILED = 0

# Helper function to print test results
function Print-Result {
    param(
        [string]$TestName,
        [string]$Expected,
        [string]$Actual
    )
    
    if ($Expected -eq $Actual) {
        Write-Host "✓ PASS: $TestName" -ForegroundColor Green
        $script:PASSED++
    } else {
        Write-Host "✗ FAIL: $TestName (expected: $Expected, got: $Actual)" -ForegroundColor Red
        $script:FAILED++
    }
}

# Test 1: Health check (no auth required)
Write-Host "Test 1: Health check (no auth required)" -ForegroundColor Yellow
Write-Host "=========================================="
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/health" -Method GET -UseBasicParsing
    Print-Result "Health check returns 200" "200" $response.StatusCode.ToString()
} catch {
    Print-Result "Health check returns 200" "200" $_.Exception.Response.StatusCode.value__.ToString()
}
Write-Host ""

# Test 2: Auth endpoint without token (should return 401)
Write-Host "Test 2: Auth endpoint without token" -ForegroundColor Yellow
Write-Host "=========================================="
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/v1/auth/me" -Method GET -UseBasicParsing
    Print-Result "Auth endpoint without token returns 401" "401" $response.StatusCode.ToString()
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
    Print-Result "Auth endpoint without token returns 401" "401" $statusCode
    
    if ($statusCode -eq "401") {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        
        if ($responseBody -like "*missing_auth_header*") {
            Write-Host "✓ PASS: Returns correct error code (missing_auth_header)" -ForegroundColor Green
            $script:PASSED++
        } else {
            Write-Host "✗ FAIL: Incorrect error code in response" -ForegroundColor Red
            Write-Host "Response: $responseBody"
            $script:FAILED++
        }
    }
}
Write-Host ""

# Test 3: Auth endpoint with invalid token (should return 401)
Write-Host "Test 3: Auth endpoint with invalid token" -ForegroundColor Yellow
Write-Host "=========================================="
$headers = @{
    "Authorization" = "Bearer invalid.token.here"
}
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/v1/auth/me" -Method GET -Headers $headers -UseBasicParsing
    Print-Result "Invalid token returns 401" "401" $response.StatusCode.ToString()
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
    Print-Result "Invalid token returns 401" "401" $statusCode
    
    if ($statusCode -eq "401") {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        
        if ($responseBody -like "*invalid_token*") {
            Write-Host "✓ PASS: Returns correct error code (invalid_token)" -ForegroundColor Green
            $script:PASSED++
        } else {
            Write-Host "✗ FAIL: Incorrect error code in response" -ForegroundColor Red
            Write-Host "Response: $responseBody"
            $script:FAILED++
        }
    }
}
Write-Host ""

# Test 4: Auth endpoint with valid token (if provided)
if ($TEST_TOKEN) {
    Write-Host "Test 4: Auth endpoint with valid token" -ForegroundColor Yellow
    Write-Host "=========================================="
    $headers = @{
        "Authorization" = "Bearer $TEST_TOKEN"
    }
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/v1/auth/me" -Method GET -Headers $headers -UseBasicParsing
        Print-Result "Valid token returns 200" "200" $response.StatusCode.ToString()
        
        $responseBody = $response.Content
        if ($responseBody -like "*authenticated*") {
            Write-Host "✓ PASS: Response contains 'authenticated' field" -ForegroundColor Green
            $script:PASSED++
        } else {
            Write-Host "✗ FAIL: Response missing 'authenticated' field" -ForegroundColor Red
            $script:FAILED++
        }
        
        if ($responseBody -like "*userId*") {
            Write-Host "✓ PASS: Response contains 'userId' field" -ForegroundColor Green
            $script:PASSED++
        } else {
            Write-Host "✗ FAIL: Response missing 'userId' field" -ForegroundColor Red
            $script:FAILED++
        }
        
        Write-Host ""
        Write-Host "User info:"
        Write-Host $responseBody
        Write-Host ""
    } catch {
        Print-Result "Valid token returns 200" "200" $_.Exception.Response.StatusCode.value__.ToString()
    }
    
    # Test 5: Sync endpoint with valid token
    Write-Host "Test 5: Sync pull endpoint with valid token" -ForegroundColor Yellow
    Write-Host "=========================================="
    $headers = @{
        "Authorization" = "Bearer $TEST_TOKEN"
        "x-kyar-device-id" = "test-device"
        "x-kyar-client" = "web"
    }
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/v1/sync/pull" -Method GET -Headers $headers -UseBasicParsing
        $statusCode = $response.StatusCode.ToString()
        if ($statusCode -eq "200" -or $statusCode -eq "403") {
            Write-Host "✓ PASS: Sync endpoint returns $statusCode (auth successful, may be tier restricted)" -ForegroundColor Green
            $script:PASSED++
        } else {
            Write-Host "✗ FAIL: Sync endpoint returns $statusCode (expected 200 or 403)" -ForegroundColor Red
            $script:FAILED++
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
        if ($statusCode -eq "200" -or $statusCode -eq "403") {
            Write-Host "✓ PASS: Sync endpoint returns $statusCode (auth successful, may be tier restricted)" -ForegroundColor Green
            $script:PASSED++
        } else {
            Write-Host "✗ FAIL: Sync endpoint returns $statusCode (expected 200 or 403)" -ForegroundColor Red
            $script:FAILED++
        }
    }
    Write-Host ""
} else {
    Write-Host "⚠ SKIP: Tests 4-5 skipped (no TEST_TOKEN provided)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To test with a valid token:"
    Write-Host "1. Sign in to the web app"
    Write-Host "2. Get token from browser console"
    Write-Host '3. Run: $env:TEST_TOKEN="your-token"; .\test_auth.ps1'
    Write-Host ""
}

# Test 6: CORS preflight
Write-Host "Test 6: CORS preflight (OPTIONS)" -ForegroundColor Yellow
Write-Host "=========================================="
$headers = @{
    "Origin" = "http://localhost:3000"
    "Access-Control-Request-Method" = "GET"
}
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/v1/auth/me" -Method OPTIONS -Headers $headers -UseBasicParsing
    $statusCode = $response.StatusCode.ToString()
    if ($statusCode -eq "204" -or $statusCode -eq "200") {
        Write-Host "✓ PASS: CORS preflight returns $statusCode" -ForegroundColor Green
        $script:PASSED++
    } else {
        Write-Host "✗ FAIL: CORS preflight returns $statusCode (expected 204 or 200)" -ForegroundColor Red
        $script:FAILED++
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__.ToString()
    if ($statusCode -eq "204" -or $statusCode -eq "200") {
        Write-Host "✓ PASS: CORS preflight returns $statusCode" -ForegroundColor Green
        $script:PASSED++
    } else {
        Write-Host "✗ FAIL: CORS preflight returns $statusCode (expected 204 or 200)" -ForegroundColor Red
        $script:FAILED++
    }
}
Write-Host ""

# Summary
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Passed: $PASSED" -ForegroundColor Green
Write-Host "Failed: $FAILED" -ForegroundColor Red
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed." -ForegroundColor Red
    exit 1
}
