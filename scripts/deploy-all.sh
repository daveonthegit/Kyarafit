#!/bin/bash
# Deploy all Kyarafit services to GCP Cloud Run

set -e  # Exit on error

# Configuration
PROJECT_ID="kyarafit"
REGION="us-central1"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploying Kyarafit to GCP${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verify gcloud is authenticated
echo -e "${GREEN}Verifying authentication...${NC}"
gcloud config set project $PROJECT_ID

# Get backend image service URL for backend env var
echo -e "${GREEN}[1/3] Deploying Image Service...${NC}"
cd image-service
gcloud run deploy kyarafit-image-service \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 5 \
  --min-instances 0 \
  --timeout 300s \
  --concurrency 10 \
  --quiet

IMAGE_SERVICE_URL=$(gcloud run services describe kyarafit-image-service \
  --region $REGION \
  --format 'value(status.url)')

echo -e "${GREEN}✓ Image Service deployed to: $IMAGE_SERVICE_URL${NC}"
echo ""

# Deploy Backend
echo -e "${GREEN}[2/3] Deploying Backend...${NC}"
cd ../backend
gcloud run deploy kyarafit-backend \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "PORT=8080,HOST=0.0.0.0,IMAGE_SERVICE_URL=$IMAGE_SERVICE_URL" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --set-secrets="SUPABASE_URL=supabase-url:latest" \
  --set-secrets="JWT_SECRET=jwt-secret:latest" \
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest" \
  --set-secrets="SMTP_HOST=smtp-host:latest" \
  --set-secrets="SMTP_PORT=smtp-port:latest" \
  --set-secrets="SMTP_USERNAME=smtp-username:latest" \
  --set-secrets="SMTP_PASSWORD=smtp-password:latest" \
  --set-secrets="SMTP_FROM=smtp-from:latest" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 60s \
  --concurrency 80 \
  --quiet

BACKEND_URL=$(gcloud run services describe kyarafit-backend \
  --region $REGION \
  --format 'value(status.url)')

echo -e "${GREEN}✓ Backend deployed to: $BACKEND_URL${NC}"
echo ""

# Deploy Web Frontend
echo -e "${GREEN}[3/3] Deploying Web Frontend...${NC}"
cd ../web

# Use custom domain URLs if they exist, otherwise use Cloud Run URLs
WEB_URL="https://www.kyarafit.com"
API_URL="https://api.kyarafit.com"
IMAGE_URL="https://images.kyarafit.com"

gcloud run deploy kyarafit-web \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_APP_URL=$WEB_URL" \
  --set-env-vars "NEXT_PUBLIC_API_URL=$API_URL" \
  --set-env-vars "NEXT_PUBLIC_IMAGE_SERVICE_URL=$IMAGE_URL" \
  --set-env-vars "BETTER_AUTH_URL=$WEB_URL" \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets="BETTER_AUTH_SECRET=auth-secret:latest" \
  --set-secrets="DATABASE_URL=database-url:latest" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --timeout 60s \
  --concurrency 80 \
  --quiet

WEB_SERVICE_URL=$(gcloud run services describe kyarafit-web \
  --region $REGION \
  --format 'value(status.url)')

echo -e "${GREEN}✓ Web Frontend deployed to: $WEB_SERVICE_URL${NC}"
echo ""

cd ..

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Service URLs:${NC}"
echo -e "Backend:       $BACKEND_URL"
echo -e "Web:           $WEB_SERVICE_URL"
echo -e "Image Service: $IMAGE_SERVICE_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test the services at their URLs above"
echo "2. Map custom domains: ./scripts/setup-domains.sh"
echo "3. Update mobile app API URLs to point to: $BACKEND_URL"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "• View logs:    gcloud run logs read kyarafit-backend --region $REGION"
echo "• List services: gcloud run services list --region $REGION"
echo "• Update env:   gcloud run services update SERVICE_NAME --set-env-vars KEY=VALUE"
echo ""
