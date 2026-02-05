# GCP Setup Script for Kyarafit (PowerShell)
# This script sets up the GCP project, enables APIs, creates repositories, and configures secrets

$ErrorActionPreference = "Continue"

# Configuration
$PROJECT_ID = "kyarafit"
$REGION = "us-central1"
$ARTIFACT_REPO = "kyarafit"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Kyarafit GCP Setup Script" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Step 1: Verify gcloud is installed
Write-Host "[1/10] Checking gcloud CLI..." -ForegroundColor Green
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Error: gcloud CLI is not installed" -ForegroundColor Red
    Write-Host "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
}
Write-Host "✓ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Step 2: Authenticate
Write-Host "[2/10] Authenticating to Google Cloud..." -ForegroundColor Green
gcloud auth login

# Fix quota project warning
Write-Host "Updating Application Default Credentials..." -ForegroundColor Blue
gcloud auth application-default login --quiet 2>&1 | Out-Null
Write-Host ""

# Step 3: Create or set project
Write-Host "[3/10] Setting up GCP project: $PROJECT_ID..." -ForegroundColor Green
try {
    $null = gcloud projects describe $PROJECT_ID 2>&1
    Write-Host "Project $PROJECT_ID already exists" -ForegroundColor Yellow
} catch {
    Write-Host "Creating new project: $PROJECT_ID" -ForegroundColor Blue
    gcloud projects create $PROJECT_ID --name="Kyarafit"
}
$null = gcloud config set project $PROJECT_ID 2>&1

# Set quota project to fix the warning
Write-Host "Setting quota project..." -ForegroundColor Blue
gcloud auth application-default set-quota-project $PROJECT_ID 2>&1 | Out-Null

Write-Host "✓ Project set to: $PROJECT_ID" -ForegroundColor Green
Write-Host ""

# Step 4: Enable required APIs
Write-Host "[4/10] Enabling required GCP APIs..." -ForegroundColor Green
Write-Host "This may take a few minutes..."
gcloud services enable `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com `
    secretmanager.googleapis.com `
    iamcredentials.googleapis.com `
    iam.googleapis.com `
    cloudresourcemanager.googleapis.com

Write-Host "✓ APIs enabled" -ForegroundColor Green
Write-Host ""

# Step 5: Create Artifact Registry repository
Write-Host "[5/10] Creating Artifact Registry repository..." -ForegroundColor Green

# Check if repository exists by listing repositories
$repoList = gcloud artifacts repositories list --location=$REGION --format="value(name)" 2>&1
if ($repoList -match $ARTIFACT_REPO) {
    Write-Host "Repository $ARTIFACT_REPO already exists" -ForegroundColor Yellow
} else {
    Write-Host "Creating new repository..." -ForegroundColor Blue
    gcloud artifacts repositories create $ARTIFACT_REPO `
        --repository-format=docker `
        --location=$REGION `
        --description="Kyarafit Docker images"
    Write-Host "✓ Repository created" -ForegroundColor Green
}
Write-Host ""

# Step 6: Create service account for GitHub Actions
Write-Host "[6/10] Setting up service account for GitHub Actions..." -ForegroundColor Green
$SERVICE_ACCOUNT = "github-actions@$PROJECT_ID.iam.gserviceaccount.com"

# Check if service account exists by listing all service accounts
$saList = gcloud iam service-accounts list --format="value(email)" 2>&1
if ($saList -match "github-actions@$PROJECT_ID.iam.gserviceaccount.com") {
    Write-Host "Service account already exists" -ForegroundColor Yellow
} else {
    Write-Host "Creating service account..." -ForegroundColor Blue
    gcloud iam service-accounts create github-actions `
        --display-name="GitHub Actions Service Account" `
        --description="Service account for GitHub Actions CI/CD"
    Write-Host "✓ Service account created" -ForegroundColor Green
    Start-Sleep -Seconds 5  # Wait for service account to propagate
}
Write-Host ""

# Step 7: Grant necessary IAM roles
Write-Host "[7/10] Granting IAM roles to service account..." -ForegroundColor Green

# Wait a bit more to ensure service account is fully propagated
Write-Host "Waiting for service account to propagate..." -ForegroundColor Blue
Start-Sleep -Seconds 10

Write-Host "Granting Cloud Run Admin role..." -ForegroundColor Blue
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/run.admin"

Write-Host "Granting Artifact Registry Writer role..." -ForegroundColor Blue
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/artifactregistry.writer"

Write-Host "Granting Service Account User role..." -ForegroundColor Blue
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/iam.serviceAccountUser"

Write-Host "Granting Secret Manager Accessor role..." -ForegroundColor Blue
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SERVICE_ACCOUNT" `
    --role="roles/secretmanager.secretAccessor"

Write-Host "✓ IAM roles granted" -ForegroundColor Green
Write-Host ""

# Step 8: Set up Workload Identity Federation
Write-Host "[8/10] Setting up Workload Identity Federation for GitHub Actions..." -ForegroundColor Green

$POOL_NAME = "github-pool"
$poolList = gcloud iam workload-identity-pools list --location=global --format="value(name)" 2>&1
if ($poolList -match $POOL_NAME) {
    Write-Host "Workload Identity Pool already exists" -ForegroundColor Yellow
} else {
    Write-Host "Creating Workload Identity Pool..." -ForegroundColor Blue
    gcloud iam workload-identity-pools create $POOL_NAME `
        --location="global" `
        --display-name="GitHub Actions Pool"
    Write-Host "✓ Workload Identity Pool created" -ForegroundColor Green
    Start-Sleep -Seconds 3
}

$PROVIDER_NAME = "github-provider"
$providerList = gcloud iam workload-identity-pools providers list --workload-identity-pool=$POOL_NAME --location=global --format="value(name)" 2>&1
if ($providerList -match $PROVIDER_NAME) {
    Write-Host "Workload Identity Provider already exists" -ForegroundColor Yellow
} else {
    Write-Host "Creating Workload Identity Provider..." -ForegroundColor Blue
    
    # Try without attribute condition first (simpler)
    $result = gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME `
        --location="global" `
        --workload-identity-pool=$POOL_NAME `
        --display-name="GitHub Provider" `
        --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" `
        --issuer-uri="https://token.actions.githubusercontent.com" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        # If that fails, try with attribute condition
        Write-Host "Retrying with attribute condition..." -ForegroundColor Blue
        gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME `
            --location="global" `
            --workload-identity-pool=$POOL_NAME `
            --display-name="GitHub Provider" `
            --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" `
            --attribute-condition="assertion.repository_owner != ''" `
            --issuer-uri="https://token.actions.githubusercontent.com"
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Workload Identity Provider created" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Provider creation failed. See error above." -ForegroundColor Red
        Write-Host "You may need to create it manually or adjust the configuration." -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 3
}

Write-Host ""

# Step 8b: Allow GitHub to impersonate service account
Write-Host "Configuring Workload Identity binding..." -ForegroundColor Blue
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format='value(projectNumber)'

Write-Host "⚠️  IMPORTANT: Enter your GitHub repository name" -ForegroundColor Yellow
Write-Host "Format: username/repo-name (e.g., daveonthegit/Kyarafit)" -ForegroundColor Gray
$GITHUB_REPO = Read-Host "GitHub repository"

if ($GITHUB_REPO -and $GITHUB_REPO -match "^[\w-]+/[\w-]+$") {
    Write-Host "Binding $GITHUB_REPO to service account..." -ForegroundColor Blue
    
    $bindingResult = gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT `
        --role="roles/iam.workloadIdentityUser" `
        --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$GITHUB_REPO" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Workload Identity binding created for $GITHUB_REPO" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: Binding may have failed. Check output above." -ForegroundColor Yellow
        Write-Host "Manual command:" -ForegroundColor Gray
        Write-Host "gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT \`" -ForegroundColor Gray
        Write-Host "  --role='roles/iam.workloadIdentityUser' \`" -ForegroundColor Gray
        Write-Host "  --member='principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$GITHUB_REPO'" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Invalid or empty repository name. You'll need to add the binding manually:" -ForegroundColor Yellow
    Write-Host "gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT \`" -ForegroundColor Gray
    Write-Host "  --role='roles/iam.workloadIdentityUser' \`" -ForegroundColor Gray
    Write-Host "  --member='principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/YOUR_GITHUB_USERNAME/YOUR_REPO'" -ForegroundColor Gray
}

Write-Host ""

# Step 9: Create secrets prompt
Write-Host "[9/10] Setting up secrets..." -ForegroundColor Green
Write-Host "You'll need to manually create the following secrets:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Run these commands with your actual values:"
Write-Host ""
Write-Host "# Database URL (Supabase PostgreSQL)" -ForegroundColor Blue
Write-Host 'echo -n "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" | gcloud secrets create database-url --data-file=-'
Write-Host ""
Write-Host "# Supabase URL" -ForegroundColor Blue
Write-Host 'echo -n "https://[PROJECT].supabase.co" | gcloud secrets create supabase-url --data-file=-'
Write-Host ""
Write-Host "# JWT Secret" -ForegroundColor Blue
Write-Host 'echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-'
Write-Host ""
Write-Host "# Supabase Service Key" -ForegroundColor Blue
Write-Host 'echo -n "your-service-key" | gcloud secrets create supabase-service-key --data-file=-'
Write-Host ""
Write-Host "# Better Auth Secret" -ForegroundColor Blue
Write-Host 'echo -n "your-random-auth-secret" | gcloud secrets create auth-secret --data-file=-'
Write-Host ""

Read-Host "Press Enter after creating secrets to continue"
Write-Host ""

# Step 10: Output GitHub Secrets
Write-Host "[10/10] GitHub Repository Secrets Configuration" -ForegroundColor Green
Write-Host ""
Write-Host "Add these secrets to your GitHub repository:" -ForegroundColor Yellow
Write-Host ""

$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format='value(projectNumber)'
$WIF_PROVIDER = "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"

Write-Host "Secret Name: GCP_WIF_PROVIDER"
Write-Host "Secret Value: $WIF_PROVIDER"
Write-Host ""
Write-Host "Secret Name: GCP_SERVICE_ACCOUNT"
Write-Host "Secret Value: $SERVICE_ACCOUNT"
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Blue
Write-Host "1. Add the GitHub secrets shown above to your repository"
Write-Host "2. Run '.\scripts\deploy-all.ps1' to deploy all services"
Write-Host "3. Set up custom domains with '.\scripts\setup-domains.ps1'"
Write-Host ""
