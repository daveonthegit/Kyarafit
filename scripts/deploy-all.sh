#!/bin/bash
# Deploy the Kyarafit web app to GCP Cloud Run.
# The backend is Convex (deployed separately with `npx convex deploy`).

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
echo -e "${BLUE}  Deploying Kyarafit web to GCP${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verify gcloud is authenticated
echo -e "${GREEN}Verifying authentication...${NC}"
gcloud config set project $PROJECT_ID

# Deploy Web Frontend
echo -e "${GREEN}Deploying Web Frontend...${NC}"
cd web

WEB_URL="https://www.kyarafit.com"

gcloud run deploy kyarafit-web \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_APP_URL=$WEB_URL" \
  --set-env-vars "BETTER_AUTH_URL=$WEB_URL" \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets="BETTER_AUTH_SECRET=auth-secret:latest" \
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
echo -e "Web:           $WEB_SERVICE_URL"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test the service at the URL above"
echo "2. Map custom domains: ./scripts/setup-domains.sh"
echo "3. Deploy the Convex backend: npx convex deploy"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "• View logs:     gcloud run logs read kyarafit-web --region $REGION"
echo "• List services: gcloud run services list --region $REGION"
echo "• Update env:    gcloud run services update SERVICE_NAME --set-env-vars KEY=VALUE"
echo ""
