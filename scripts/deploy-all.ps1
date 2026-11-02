# Deploy the Kyarafit web app to GCP Cloud Run (PowerShell).
# The backend is Convex (deployed separately with `npx convex deploy`).

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "kyarafit"
$REGION = "us-central1"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Deploying Kyarafit web to GCP" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Verify gcloud is authenticated
Write-Host "Verifying authentication..." -ForegroundColor Green
gcloud config set project $PROJECT_ID

# Deploy Web Frontend
Write-Host "Deploying Web Frontend..." -ForegroundColor Green
Set-Location web

$WEB_URL = "https://www.kyarafit.com"

gcloud run deploy kyarafit-web `
  --source . `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars "NEXT_PUBLIC_APP_URL=$WEB_URL" `
  --set-env-vars "BETTER_AUTH_URL=$WEB_URL" `
  --set-env-vars "NODE_ENV=production" `
  --set-secrets="BETTER_AUTH_SECRET=auth-secret:latest" `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 10 `
  --min-instances 0 `
  --timeout 60s `
  --concurrency 80 `
  --quiet

$WEB_SERVICE_URL = gcloud run services describe kyarafit-web `
  --region $REGION `
  --format 'value(status.url)'

Write-Host "✓ Web Frontend deployed to: $WEB_SERVICE_URL" -ForegroundColor Green
Write-Host ""

Set-Location ..

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Complete! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Blue
Write-Host "Web:           $WEB_SERVICE_URL"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test the service at the URL above"
Write-Host "2. Map custom domains: .\scripts\setup-domains.ps1"
Write-Host "3. Deploy the Convex backend: npx convex deploy"
Write-Host ""
