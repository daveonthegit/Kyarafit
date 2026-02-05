# Import secrets from .env.gcp.secrets to GCP Secret Manager
# This script reads your secrets file and creates all secrets in GCP automatically

$ErrorActionPreference = "Continue"

$PROJECT_ID = "kyarafit"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  GCP Secret Manager Import" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Check if secrets file exists
if (-not (Test-Path ".env.gcp.secrets")) {
    Write-Host "Error: .env.gcp.secrets file not found!" -ForegroundColor Red
    Write-Host "Please create it and fill in your values" -ForegroundColor Yellow
    exit 1
}

Write-Host "Reading secrets from .env.gcp.secrets..." -ForegroundColor Green
Write-Host ""

# Parse .env file
$secrets = @{}
Get-Content ".env.gcp.secrets" | ForEach-Object {
    $line = $_.Trim()
    # Skip comments and empty lines
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            if ($value) {
                $secrets[$key] = $value
            }
        }
    }
}

# Validate required secrets
$requiredSecrets = @(
    "DATABASE_URL",
    "SUPABASE_URL", 
    "JWT_SECRET",
    "SUPABASE_SERVICE_KEY",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USERNAME",
    "SMTP_PASSWORD",
    "SMTP_FROM"
)

$missingSecrets = @()
foreach ($secret in $requiredSecrets) {
    if (-not $secrets.ContainsKey($secret) -or -not $secrets[$secret]) {
        $missingSecrets += $secret
    }
}

if ($missingSecrets.Count -gt 0) {
    Write-Host "Error: Missing required secrets:" -ForegroundColor Red
    $missingSecrets | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Please fill in these values in .env.gcp.secrets" -ForegroundColor Yellow
    exit 1
}

# Generate auth-secret if not provided
if (-not $secrets.ContainsKey("AUTH_SECRET") -or -not $secrets["AUTH_SECRET"]) {
    Write-Host "Generating random AUTH_SECRET..." -ForegroundColor Blue
    $secrets["AUTH_SECRET"] = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
}

# Set project
gcloud config set project $PROJECT_ID | Out-Null

Write-Host "Creating secrets in GCP Secret Manager..." -ForegroundColor Green
Write-Host ""

# Mapping of env vars to GCP secret names
$secretMapping = @{
    "DATABASE_URL" = "database-url"
    "SUPABASE_URL" = "supabase-url"
    "JWT_SECRET" = "jwt-secret"
    "SUPABASE_SERVICE_KEY" = "supabase-service-key"
    "AUTH_SECRET" = "auth-secret"
    "SMTP_HOST" = "smtp-host"
    "SMTP_PORT" = "smtp-port"
    "SMTP_USERNAME" = "smtp-username"
    "SMTP_PASSWORD" = "smtp-password"
    "SMTP_FROM" = "smtp-from"
}

$created = 0
$updated = 0
$failed = 0

foreach ($envVar in $secretMapping.Keys) {
    $secretName = $secretMapping[$envVar]
    $secretValue = $secrets[$envVar]
    
    if (-not $secretValue) {
        Write-Host "⚠️  Skipping $secretName (empty value)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "Processing $secretName..." -NoNewline
    
    # Check if secret exists by trying to describe it
    $checkResult = gcloud secrets describe $secretName --project=$PROJECT_ID 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # Secret exists, add new version
        $tempFile = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $tempFile -Value $secretValue -NoNewline
        $result = gcloud secrets versions add $secretName --data-file=$tempFile --project=$PROJECT_ID 2>&1
        Remove-Item $tempFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✓ Updated" -ForegroundColor Cyan
            $updated++
        } else {
            Write-Host " ✗ Failed to update" -ForegroundColor Red
            $failed++
        }
    } else {
        # Secret doesn't exist, create it
        $tempFile = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $tempFile -Value $secretValue -NoNewline
        $result = gcloud secrets create $secretName --data-file=$tempFile --project=$PROJECT_ID 2>&1
        Remove-Item $tempFile -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✓ Created" -ForegroundColor Green
            $created++
        } else {
            Write-Host " ✗ Failed to create" -ForegroundColor Red
            Write-Host "   Error: $result" -ForegroundColor Gray
            $failed++
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Import Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Blue
Write-Host "  Created: $created secrets" -ForegroundColor Green
Write-Host "  Updated: $updated secrets" -ForegroundColor Cyan
if ($failed -gt 0) {
    Write-Host "  Failed:  $failed secrets" -ForegroundColor Red
} else {
    Write-Host "  Failed:  $failed secrets" -ForegroundColor Green
}
Write-Host ""

# List all secrets
Write-Host "Secrets in Secret Manager:" -ForegroundColor Blue
gcloud secrets list --project=$PROJECT_ID

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  ⚠️  DELETE .env.gcp.secrets NOW!" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "This file contains your actual secrets and should NOT be kept!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Delete it now:" -ForegroundColor Red
Write-Host "  Remove-Item .env.gcp.secrets -Force" -ForegroundColor White
Write-Host ""
Write-Host "Then verify it's gone:" -ForegroundColor Yellow
Write-Host "  Test-Path .env.gcp.secrets" -ForegroundColor White
Write-Host "  (should return: False)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "1. ✅ Secrets imported to GCP"
Write-Host "2. ❌ Delete .env.gcp.secrets file"
Write-Host "3. Add GitHub secrets (GCP_WIF_PROVIDER, GCP_SERVICE_ACCOUNT)"
Write-Host "4. Deploy: .\scripts\deploy-all.ps1"
Write-Host ""
