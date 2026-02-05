# Deploy all Kyarafit services to GCP Cloud Run (PowerShell)

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "kyarafit"
$REGION = "us-central1"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Deploying Kyarafit to GCP" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Verify gcloud is authenticated
Write-Host "Verifying authentication..." -ForegroundColor Green
gcloud config set project $PROJECT_ID

# Deploy Image Service
Write-Host "[1/3] Deploying Image Service..." -ForegroundColor Green
Set-Location image-service
gcloud run deploy kyarafit-image-service `
  --source . `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --memory 2Gi `
  --cpu 2 `
  --max-instances 5 `
  --min-instances 0 `
  --timeout 300s `
  --concurrency 10 `
  --quiet

$IMAGE_SERVICE_URL = gcloud run services describe kyarafit-image-service `
  --region $REGION `
  --format 'value(status.url)'

Write-Host "✓ Image Service deployed to: $IMAGE_SERVICE_URL" -ForegroundColor Green
Write-Host ""

# Deploy Backend
Write-Host "[2/3] Deploying Backend..." -ForegroundColor Green
Set-Location ..\backend
gcloud run deploy kyarafit-backend `
  --source . `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars "PORT=8080,HOST=0.0.0.0,IMAGE_SERVICE_URL=$IMAGE_SERVICE_URL" `
  --set-secrets="DATABASE_URL=database-url:latest" `
  --set-secrets="SUPABASE_URL=supabase-url:latest" `
  --set-secrets="JWT_SECRET=jwt-secret:latest" `
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest" `
  --set-secrets="SMTP_HOST=smtp-host:latest" `
  --set-secrets="SMTP_PORT=smtp-port:latest" `
  --set-secrets="SMTP_USERNAME=smtp-username:latest" `
  --set-secrets="SMTP_PASSWORD=smtp-password:latest" `
  --set-secrets="SMTP_FROM=smtp-from:latest" `
  --memory 512Mi `
  --cpu 1 `
  --max-instances 10 `
  --min-instances 0 `
  --timeout 60s `
  --concurrency 80 `
  --quiet

$BACKEND_URL = gcloud run services describe kyarafit-backend `
  --region $REGION `
  --format 'value(status.url)'

Write-Host "✓ Backend deployed to: $BACKEND_URL" -ForegroundColor Green
Write-Host ""

# Deploy Web Frontend
Write-Host "[3/3] Deploying Web Frontend..." -ForegroundColor Green
Set-Location ..\web

$WEB_URL = "https://www.kyarafit.com"
$API_URL = "https://api.kyarafit.com"
$IMAGE_URL = "https://images.kyarafit.com"

gcloud run deploy kyarafit-web `
  --source . `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars "NEXT_PUBLIC_APP_URL=$WEB_URL" `
  --set-env-vars "NEXT_PUBLIC_API_URL=$API_URL" `
  --set-env-vars "NEXT_PUBLIC_IMAGE_SERVICE_URL=$IMAGE_URL" `
  --set-env-vars "BETTER_AUTH_URL=$WEB_URL" `
  --set-env-vars "NODE_ENV=production" `
  --set-secrets="BETTER_AUTH_SECRET=auth-secret:latest" `
  --set-secrets="DATABASE_URL=database-url:latest" `
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
Write-Host "Backend:       $BACKEND_URL"
Write-Host "Web:           $WEB_SERVICE_URL"
Write-Host "Image Service: $IMAGE_SERVICE_URL"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test the services at their URLs above"
Write-Host "2. Map custom domains: .\scripts\setup-domains.ps1"
Write-Host "3. Update mobile app API URLs"
Write-Host ""
