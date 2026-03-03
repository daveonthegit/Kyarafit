# SMTP Configuration Test Script (PowerShell)
# This script tests your SMTP configuration

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Kyarafit SMTP Configuration Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
$envFile = ".env"
if (Test-Path $envFile) {
    Write-Host "✓ Found .env file" -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "✗ No .env file found!" -ForegroundColor Red
    Write-Host "  Please create a .env file with SMTP configuration"
    exit 1
}

# Check required variables
Write-Host ""
Write-Host "Checking SMTP configuration..."
Write-Host ""

$missing = 0

$smtpHost = $env:SMTP_HOST
$smtpPort = $env:SMTP_PORT
$smtpUsername = $env:SMTP_USERNAME
$smtpPassword = $env:SMTP_PASSWORD
$smtpFrom = $env:SMTP_FROM

if ([string]::IsNullOrEmpty($smtpHost)) {
    Write-Host "✗ SMTP_HOST is not set" -ForegroundColor Red
    $missing = 1
} else {
    Write-Host "✓ SMTP_HOST: $smtpHost" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($smtpPort)) {
    Write-Host "✗ SMTP_PORT is not set" -ForegroundColor Red
    $missing = 1
} else {
    Write-Host "✓ SMTP_PORT: $smtpPort" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($smtpUsername)) {
    Write-Host "✗ SMTP_USERNAME is not set" -ForegroundColor Red
    $missing = 1
} else {
    Write-Host "✓ SMTP_USERNAME: $smtpUsername" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($smtpPassword)) {
    Write-Host "✗ SMTP_PASSWORD is not set" -ForegroundColor Red
    $missing = 1
} else {
    Write-Host "✓ SMTP_PASSWORD: ********" -ForegroundColor Green
}

if ([string]::IsNullOrEmpty($smtpFrom)) {
    Write-Host "✗ SMTP_FROM is not set" -ForegroundColor Red
    $missing = 1
} else {
    Write-Host "✓ SMTP_FROM: $smtpFrom" -ForegroundColor Green
}

if ($missing -eq 1) {
    Write-Host ""
    Write-Host "✗ SMTP configuration is incomplete!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set the following in your .env file:"
    Write-Host "  SMTP_HOST=smtp.gmail.com"
    Write-Host "  SMTP_PORT=587"
    Write-Host "  SMTP_USERNAME=your-email@gmail.com"
    Write-Host "  SMTP_PASSWORD=your-app-password"
    Write-Host "  SMTP_FROM=Kyarafit <noreply@kyarafit.com>"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "All required SMTP variables are set!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Test connection
Write-Host "Testing SMTP connection..."
Write-Host ""

# Check if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✓ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend server is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Start the server with:"
    Write-Host "  go run main.go"
    Write-Host ""
    Write-Host "Or with Docker:"
    Write-Host "  docker-compose up -d"
    Write-Host ""
    exit 1
}

Write-Host ""

# Verify SMTP configuration
Write-Host "Verifying SMTP configuration with server..."
try {
    $verifyResponse = Invoke-RestMethod -Uri "http://localhost:8080/api/test/email/verify" -Method Get
    $verifyResponse | ConvertTo-Json
    Write-Host ""
    
    if ($verifyResponse.configured -eq $true) {
        Write-Host "✓ SMTP configuration verified!" -ForegroundColor Green
    } else {
        Write-Host "✗ SMTP verification failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check your SMTP credentials and try again."
        Write-Host "See SMTP_SETUP.md for detailed configuration guide."
        exit 1
    }
} catch {
    Write-Host "✗ Failed to verify SMTP configuration" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

Write-Host ""

# Send test email
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Ready to send test email!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$testEmail = Read-Host "Enter email address to send test email to"

if ([string]::IsNullOrEmpty($testEmail)) {
    Write-Host "No email address provided. Skipping test email."
    exit 0
}

Write-Host ""
Write-Host "Sending test email to $testEmail..."
Write-Host ""

try {
    $body = @{
        to = $testEmail
    } | ConvertTo-Json

    $testResponse = Invoke-RestMethod -Uri "http://localhost:8080/api/test/email" -Method Post -Body $body -ContentType "application/json"
    $testResponse | ConvertTo-Json
    Write-Host ""
    
    if ($testResponse.success -eq $true) {
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host "✓ Test email sent successfully!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check your inbox at: $testEmail"
        Write-Host ""
        Write-Host "If you don't see the email:"
        Write-Host "1. Check your spam folder"
        Write-Host "2. Wait a few minutes (SMTP delivery can be delayed)"
        Write-Host "3. Verify the recipient email is correct"
        Write-Host ""
    } else {
        Write-Host "✗ Failed to send test email" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check the error message above and your SMTP configuration."
        Write-Host "See SMTP_SETUP.md for troubleshooting tips."
        exit 1
    }
} catch {
    Write-Host "✗ Failed to send test email" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "Please check your SMTP configuration."
    Write-Host "See SMTP_SETUP.md for troubleshooting tips."
    exit 1
}
