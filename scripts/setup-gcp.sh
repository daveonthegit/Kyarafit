#!/bin/bash
# GCP Setup Script for Kyarafit
# This script sets up the GCP project, enables APIs, creates repositories, and configures secrets

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="kyarafit"
REGION="us-central1"
ARTIFACT_REPO="kyarafit"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Kyarafit GCP Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Verify gcloud is installed
echo -e "${GREEN}[1/10] Checking gcloud CLI...${NC}"
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
echo -e "${GREEN}✓ gcloud CLI found${NC}"
echo ""

# Step 2: Authenticate
echo -e "${GREEN}[2/10] Authenticating to Google Cloud...${NC}"
gcloud auth login
echo ""

# Step 3: Create or set project
echo -e "${GREEN}[3/10] Setting up GCP project: $PROJECT_ID...${NC}"
if gcloud projects describe $PROJECT_ID &>/dev/null; then
    echo -e "${YELLOW}Project $PROJECT_ID already exists${NC}"
else
    echo -e "${BLUE}Creating new project: $PROJECT_ID${NC}"
    gcloud projects create $PROJECT_ID --name="Kyarafit"
fi
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✓ Project set to: $PROJECT_ID${NC}"
echo ""

# Step 4: Enable required APIs
echo -e "${GREEN}[4/10] Enabling required GCP APIs...${NC}"
echo "This may take a few minutes..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    iamcredentials.googleapis.com \
    iam.googleapis.com \
    cloudresourcemanager.googleapis.com

echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# Step 5: Create Artifact Registry repository
echo -e "${GREEN}[5/10] Creating Artifact Registry repository...${NC}"
if gcloud artifacts repositories describe $ARTIFACT_REPO --location=$REGION &>/dev/null; then
    echo -e "${YELLOW}Repository $ARTIFACT_REPO already exists${NC}"
else
    gcloud artifacts repositories create $ARTIFACT_REPO \
        --repository-format=docker \
        --location=$REGION \
        --description="Kyarafit Docker images"
    echo -e "${GREEN}✓ Repository created${NC}"
fi
echo ""

# Step 6: Create service account for GitHub Actions
echo -e "${GREEN}[6/10] Setting up service account for GitHub Actions...${NC}"
SERVICE_ACCOUNT="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe $SERVICE_ACCOUNT &>/dev/null; then
    echo -e "${YELLOW}Service account already exists${NC}"
else
    gcloud iam service-accounts create github-actions \
        --display-name="GitHub Actions Service Account" \
        --description="Service account for GitHub Actions CI/CD"
    echo -e "${GREEN}✓ Service account created${NC}"
fi
echo ""

# Step 7: Grant necessary IAM roles
echo -e "${GREEN}[7/10] Granting IAM roles to service account...${NC}"
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/run.admin" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/artifactregistry.writer" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/iam.serviceAccountUser" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None

echo -e "${GREEN}✓ IAM roles granted${NC}"
echo ""

# Step 8: Set up Workload Identity Federation
echo -e "${GREEN}[8/10] Setting up Workload Identity Federation for GitHub Actions...${NC}"

# Create Workload Identity Pool
POOL_NAME="github-pool"
if gcloud iam workload-identity-pools describe $POOL_NAME --location=global &>/dev/null; then
    echo -e "${YELLOW}Workload Identity Pool already exists${NC}"
else
    gcloud iam workload-identity-pools create $POOL_NAME \
        --location="global" \
        --display-name="GitHub Actions Pool"
    echo -e "${GREEN}✓ Workload Identity Pool created${NC}"
fi

# Create Workload Identity Provider
PROVIDER_NAME="github-provider"
if gcloud iam workload-identity-pools providers describe $PROVIDER_NAME \
    --workload-identity-pool=$POOL_NAME \
    --location=global &>/dev/null; then
    echo -e "${YELLOW}Workload Identity Provider already exists${NC}"
else
    gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
        --location="global" \
        --workload-identity-pool=$POOL_NAME \
        --display-name="GitHub Provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
        --issuer-uri="https://token.actions.githubusercontent.com"
    echo -e "${GREEN}✓ Workload Identity Provider created${NC}"
fi

# Allow GitHub Actions to impersonate service account
REPO_NAME="YOUR_GITHUB_USERNAME/Kyarafit"  # Update this with your GitHub repo
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$REPO_NAME"

echo ""

# Step 9: Create secrets prompt
echo -e "${GREEN}[9/10] Setting up secrets...${NC}"
echo -e "${YELLOW}You'll need to manually create the following secrets:${NC}"
echo ""
echo "Run these commands with your actual values:"
echo ""
echo -e "${BLUE}# Database URL (Supabase PostgreSQL)${NC}"
echo 'echo -n "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" | gcloud secrets create database-url --data-file=-'
echo ""
echo -e "${BLUE}# Supabase URL${NC}"
echo 'echo -n "https://[PROJECT].supabase.co" | gcloud secrets create supabase-url --data-file=-'
echo ""
echo -e "${BLUE}# JWT Secret (from Supabase Project Settings > API > JWT Secret)${NC}"
echo 'echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-'
echo ""
echo -e "${BLUE}# Supabase Service Key (from Supabase Project Settings > API > service_role key)${NC}"
echo 'echo -n "your-service-key" | gcloud secrets create supabase-service-key --data-file=-'
echo ""
echo -e "${BLUE}# Better Auth Secret (generate a random string)${NC}"
echo 'echo -n "your-random-auth-secret" | gcloud secrets create auth-secret --data-file=-'
echo ""
echo -e "${BLUE}# SMTP Configuration${NC}"
echo 'echo -n "smtp.resend.com" | gcloud secrets create smtp-host --data-file=-'
echo 'echo -n "587" | gcloud secrets create smtp-port --data-file=-'
echo 'echo -n "resend" | gcloud secrets create smtp-username --data-file=-'
echo 'echo -n "re_your_api_key" | gcloud secrets create smtp-password --data-file=-'
echo 'echo -n "Kyarafit <noreply@kyarafit.com>" | gcloud secrets create smtp-from --data-file=-'
echo ""

read -p "Press Enter after creating secrets to continue..."
echo ""

# Step 10: Output GitHub Secrets
echo -e "${GREEN}[10/10] GitHub Repository Secrets Configuration${NC}"
echo ""
echo -e "${YELLOW}Add these secrets to your GitHub repository:${NC}"
echo -e "${BLUE}Repository Settings > Secrets and variables > Actions > New repository secret${NC}"
echo ""

PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
WIF_PROVIDER="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"

echo "Secret Name: GCP_WIF_PROVIDER"
echo "Secret Value: $WIF_PROVIDER"
echo ""
echo "Secret Name: GCP_SERVICE_ACCOUNT"
echo "Secret Value: $SERVICE_ACCOUNT"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Add the GitHub secrets shown above to your repository"
echo "2. Update REPO_NAME in this script with your GitHub username"
echo "3. Re-run the Workload Identity binding if you updated REPO_NAME"
echo "4. Run './scripts/deploy-all.sh' to deploy all services"
echo "5. Set up custom domains with './scripts/setup-domains.sh'"
echo ""
echo -e "${GREEN}Deployment URLs (after deploy):${NC}"
echo "Backend: https://kyarafit-backend-[hash]-uc.a.run.app"
echo "Web: https://kyarafit-web-[hash]-uc.a.run.app"
echo "Image Service: https://kyarafit-image-service-[hash]-uc.a.run.app"
echo ""
