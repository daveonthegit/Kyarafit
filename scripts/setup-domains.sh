#!/bin/bash
# Setup custom domains for Kyarafit services on GCP Cloud Run

set -e

# Configuration
PROJECT_ID="kyarafit"
REGION="us-central1"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Kyarafit Domain Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

gcloud config set project $PROJECT_ID

# Map domains to Cloud Run services
echo -e "${GREEN}[1/4] Mapping www.kyarafit.com to web service...${NC}"
gcloud run domain-mappings create \
  --service kyarafit-web \
  --domain www.kyarafit.com \
  --region $REGION || echo -e "${YELLOW}Domain mapping already exists${NC}"

echo -e "${GREEN}[2/4] Mapping kyarafit.com (root) to web service...${NC}"
gcloud run domain-mappings create \
  --service kyarafit-web \
  --domain kyarafit.com \
  --region $REGION || echo -e "${YELLOW}Domain mapping already exists${NC}"

echo -e "${GREEN}[3/4] Mapping api.kyarafit.com to backend...${NC}"
gcloud run domain-mappings create \
  --service kyarafit-backend \
  --domain api.kyarafit.com \
  --region $REGION || echo -e "${YELLOW}Domain mapping already exists${NC}"

echo -e "${GREEN}[4/4] Mapping images.kyarafit.com to image service...${NC}"
gcloud run domain-mappings create \
  --service kyarafit-image-service \
  --domain images.kyarafit.com \
  --region $REGION || echo -e "${YELLOW}Domain mapping already exists${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Domain Mappings Created!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get DNS records for each domain
echo -e "${BLUE}DNS Configuration Required${NC}"
echo -e "${YELLOW}Add these DNS records to your domain registrar:${NC}"
echo ""

echo -e "${BLUE}For www.kyarafit.com:${NC}"
gcloud run domain-mappings describe www.kyarafit.com \
  --region $REGION \
  --format="table(status.resourceRecords[].name,status.resourceRecords[].type,status.resourceRecords[].rrdata)" 2>/dev/null || echo "Getting DNS records..."

echo ""
echo -e "${BLUE}For kyarafit.com (root):${NC}"
gcloud run domain-mappings describe kyarafit.com \
  --region $REGION \
  --format="table(status.resourceRecords[].name,status.resourceRecords[].type,status.resourceRecords[].rrdata)" 2>/dev/null || echo "Getting DNS records..."

echo ""
echo -e "${BLUE}For api.kyarafit.com:${NC}"
gcloud run domain-mappings describe api.kyarafit.com \
  --region $REGION \
  --format="table(status.resourceRecords[].name,status.resourceRecords[].type,status.resourceRecords[].rrdata)" 2>/dev/null || echo "Getting DNS records..."

echo ""
echo -e "${BLUE}For images.kyarafit.com:${NC}"
gcloud run domain-mappings describe images.kyarafit.com \
  --region $REGION \
  --format="table(status.resourceRecords[].name,status.resourceRecords[].type,status.resourceRecords[].rrdata)" 2>/dev/null || echo "Getting DNS records..."

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add the DNS records shown above to your domain registrar (GoDaddy, Namecheap, etc.)"
echo "2. Wait 15-60 minutes for DNS propagation"
echo "3. Check status: gcloud run domain-mappings list --region $REGION"
echo "4. SSL certificates will be automatically provisioned (may take up to 60 minutes)"
echo ""
echo -e "${BLUE}Check SSL status:${NC}"
echo "gcloud run domain-mappings describe www.kyarafit.com --region $REGION --format='get(status.conditions)'"
echo ""
