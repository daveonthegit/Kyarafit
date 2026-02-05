# GCP Deployment Guide for Kyarafit

Complete guide to deploying Kyarafit (Backend, Web Frontend, and Image Service) to Google Cloud Platform using Cloud Run and Docker.

## 🎯 Overview

This deployment uses:
- **GCP Cloud Run**: Serverless container hosting with auto-scaling
- **Docker**: Containerization for all services
- **Artifact Registry**: Docker image storage
- **Secret Manager**: Secure secret storage
- **Supabase**: PostgreSQL database and storage (existing)
- **GitHub Actions**: CI/CD automation

## 📋 Prerequisites

Before starting, ensure you have:

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
3. **GitHub Repository** with secrets access
4. **Supabase Project** with database and storage set up
5. **Domain Name** (optional, for custom domains like kyarafit.com)

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Windows PowerShell
.\scripts\setup-gcp.ps1

# Linux/Mac
chmod +x scripts/setup-gcp.sh
./scripts/setup-gcp.sh
```

This script will:
- Create/configure GCP project
- Enable required APIs
- Set up Artifact Registry
- Configure Workload Identity Federation
- Create service accounts
- Provide GitHub secrets

### Option 2: Manual Setup

Follow the [Manual Setup](#manual-setup-detailed) section below.

## 📦 Deployment

### Deploy All Services at Once

```bash
# Windows PowerShell
.\scripts\deploy-all.ps1

# Linux/Mac
chmod +x scripts/deploy-all.sh
./scripts/deploy-all.sh
```

### Deploy Individual Services

#### Backend
```bash
cd backend
gcloud run deploy kyarafit-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=database-url:latest,SUPABASE_URL=supabase-url:latest,JWT_SECRET=jwt-secret:latest,SUPABASE_SERVICE_KEY=supabase-service-key:latest"
```

#### Web Frontend
```bash
cd web
gcloud run deploy kyarafit-web \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_APP_URL=https://www.kyarafit.com,NEXT_PUBLIC_API_URL=https://api.kyarafit.com"
```

#### Image Service
```bash
cd image-service
gcloud run deploy kyarafit-image-service \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2
```

## 🌐 Custom Domain Setup

### Map Domains to Services

```bash
# Run the domain setup script
chmod +x scripts/setup-domains.sh
./scripts/setup-domains.sh

# Or manually:
gcloud run domain-mappings create \
  --service kyarafit-web \
  --domain www.kyarafit.com \
  --region us-central1
```

### Configure DNS Records

1. Run the domain setup script (it will output DNS records)
2. Add the DNS records to your domain registrar
3. Wait 15-60 minutes for DNS propagation
4. SSL certificates are automatically provisioned

Example DNS configuration:
```
Type: A
Name: www
Value: 216.239.32.21 (use actual values from GCP output)
TTL: 3600

Type: A
Name: api
Value: 216.239.32.21
TTL: 3600
```

## 🔐 Secrets Management

### Create Secrets in GCP Secret Manager

```bash
# Database URL (Supabase PostgreSQL)
echo -n "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" | \
  gcloud secrets create database-url --data-file=-

# Supabase URL
echo -n "https://[PROJECT].supabase.co" | \
  gcloud secrets create supabase-url --data-file=-

# JWT Secret (from Supabase: Project Settings > API > JWT Secret)
echo -n "your-jwt-secret" | \
  gcloud secrets create jwt-secret --data-file=-

# Supabase Service Key (from Supabase: Project Settings > API > service_role key)
echo -n "your-service-key" | \
  gcloud secrets create supabase-service-key --data-file=-

# Better Auth Secret (generate random string)
echo -n "$(openssl rand -base64 32)" | \
  gcloud secrets create auth-secret --data-file=-

# SMTP Configuration (for Resend or other provider)
echo -n "smtp.resend.com" | gcloud secrets create smtp-host --data-file=-
echo -n "587" | gcloud secrets create smtp-port --data-file=-
echo -n "resend" | gcloud secrets create smtp-username --data-file=-
echo -n "re_your_api_key" | gcloud secrets create smtp-password --data-file=-
echo -n "Kyarafit <noreply@kyarafit.com>" | gcloud secrets create smtp-from --data-file=-
```

### GitHub Repository Secrets

Add these to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `GCP_WIF_PROVIDER` | Workload Identity Federation provider | From setup script output |
| `GCP_SERVICE_ACCOUNT` | Service account email | From setup script output |

## 🔄 CI/CD with GitHub Actions

### Workflow Files

Three GitHub Actions workflows are included:

1. **`.github/workflows/deploy-gcp-backend.yml`** - Backend deployment
2. **`.github/workflows/deploy-gcp-web.yml`** - Web frontend deployment
3. **`.github/workflows/deploy-gcp-image-service.yml`** - Image service deployment

### Automatic Deployment

Deployments trigger automatically on:
- Push to `main` branch
- Changes to specific service directories
- Manual workflow dispatch

### Manual Deployment

```bash
# Via GitHub UI: Actions > Select workflow > Run workflow

# Via GitHub CLI
gh workflow run deploy-gcp-backend.yml
gh workflow run deploy-gcp-web.yml
gh workflow run deploy-gcp-image-service.yml
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User Browser                                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ www.kyarafit.com (Cloud Run)                            │
│ ├─ Next.js Frontend                                     │
│ ├─ Auto-scaling: 0-10 instances                         │
│ └─ Memory: 512Mi, CPU: 1                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ api.kyarafit.com (Cloud Run)                            │
│ ├─ Go/Fiber Backend API                                 │
│ ├─ Auto-scaling: 0-10 instances                         │
│ └─ Memory: 512Mi, CPU: 1                                │
└─────────────────────────────────────────────────────────┘
          ↓                           ↓
┌──────────────────────┐    ┌──────────────────────────┐
│ images.kyarafit.com  │    │ Supabase                 │
│ (Cloud Run)          │    │ ├─ PostgreSQL Database   │
│ ├─ Python/FastAPI    │    │ ├─ Object Storage        │
│ ├─ Background removal│    │ └─ Authentication        │
│ └─ Memory: 2Gi       │    │                          │
└──────────────────────┘    └──────────────────────────┘
```

## 💰 Cost Estimates

### Monthly Costs (Projected)

#### Development/Testing (100-500 users)
- Backend: $0-2
- Web Frontend: $0-3
- Image Service: $5-10
- Container Registry: $0.20
- **Total: $5-15/month**

#### Production (1,000-5,000 users)
- Backend: $8-15
- Web Frontend: $3-8
- Image Service: $40-60
- Container Registry: $0.50
- Secret Manager: $0.18
- **Total: $52-84/month**

Plus Supabase costs (separate):
- Free tier: $0
- Pro tier: $25/month
- Team tier: $599/month

### Cost Optimization Tips

1. **Scale to Zero**: Services auto-scale to 0 instances when idle
2. **Regional Selection**: Use `us-central1` (Iowa) for lowest costs
3. **Image Caching**: Cache processed images to reduce image service usage
4. **Request Batching**: Batch API calls in mobile app
5. **Monitor Usage**: Set up billing alerts

## 🔍 Monitoring & Debugging

### View Logs

```bash
# Real-time logs
gcloud run logs read kyarafit-backend --region us-central1 --follow

# Last 50 lines
gcloud run logs read kyarafit-backend --region us-central1 --limit 50

# Tail logs for specific service
gcloud run logs tail kyarafit-web --region us-central1
```

### Check Service Status

```bash
# List all services
gcloud run services list --region us-central1

# Describe specific service
gcloud run services describe kyarafit-backend --region us-central1

# Check domain mapping status
gcloud run domain-mappings list --region us-central1
```

### Monitor Metrics

```bash
# Open Cloud Console Monitoring
gcloud monitoring dashboards list

# View service metrics in browser
gcloud run services describe kyarafit-backend \
  --region us-central1 \
  --format="value(status.url)" | xargs -I {} open {}
```

## 🐛 Troubleshooting

### Issue: "Permission Denied" errors

**Solution:**
```bash
# Verify authentication
gcloud auth list

# Re-authenticate
gcloud auth login

# Verify project
gcloud config get-value project
```

### Issue: Build fails with "No such file or directory"

**Solution:**
```bash
# Ensure you're in the correct directory
cd backend  # or web, or image-service

# Verify Dockerfile exists
ls -la Dockerfile

# Check .dockerignore isn't excluding necessary files
```

### Issue: Service not accessible after deployment

**Solution:**
```bash
# Check service status
gcloud run services describe SERVICE_NAME --region us-central1

# Verify it's public
gcloud run services add-iam-policy-binding SERVICE_NAME \
  --region us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

### Issue: Environment variables not working

**Solution:**
```bash
# List current environment variables
gcloud run services describe SERVICE_NAME \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"

# Update environment variable
gcloud run services update SERVICE_NAME \
  --region us-central1 \
  --update-env-vars KEY=VALUE
```

### Issue: Secrets not accessible

**Solution:**
```bash
# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Verify secret exists
gcloud secrets versions access latest --secret=SECRET_NAME
```

### Issue: Domain mapping fails

**Solution:**
1. Verify DNS records are correct
2. Wait 15-60 minutes for DNS propagation
3. Check domain verification status:
```bash
gcloud run domain-mappings describe DOMAIN --region us-central1
```

### Issue: Container exits with error

**Solution:**
```bash
# Check logs for error details
gcloud run logs read SERVICE_NAME --region us-central1 --limit 100

# Test container locally
docker build -t test-image .
docker run -p 8080:8080 test-image

# Check environment variables in container
gcloud run services describe SERVICE_NAME --region us-central1
```

## 🔄 Updates & Rollbacks

### Update a Service

```bash
# Update with new code (redeploy)
gcloud run deploy SERVICE_NAME --source . --region us-central1

# Update environment variable only
gcloud run services update SERVICE_NAME \
  --region us-central1 \
  --update-env-vars KEY=NEW_VALUE

# Update memory/CPU
gcloud run services update SERVICE_NAME \
  --region us-central1 \
  --memory 1Gi \
  --cpu 2
```

### Rollback to Previous Version

```bash
# List revisions
gcloud run revisions list --service SERVICE_NAME --region us-central1

# Rollback to specific revision
gcloud run services update-traffic SERVICE_NAME \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

### Gradual Rollout (Canary Deployment)

```bash
# Split traffic 90/10 between revisions
gcloud run services update-traffic SERVICE_NAME \
  --region us-central1 \
  --to-revisions OLD_REVISION=90,NEW_REVISION=10
```

## 📈 Scaling Configuration

### Auto-scaling Settings

```bash
# Configure min/max instances
gcloud run services update SERVICE_NAME \
  --region us-central1 \
  --min-instances 0 \
  --max-instances 10

# Configure concurrency (requests per instance)
gcloud run services update SERVICE_NAME \
  --region us-central1 \
  --concurrency 80
```

### Resource Limits

| Service | Memory | CPU | Max Instances | Timeout |
|---------|--------|-----|---------------|---------|
| Backend | 512Mi | 1 | 10 | 60s |
| Web | 512Mi | 1 | 10 | 60s |
| Image Service | 2Gi | 2 | 5 | 300s |

## 🔒 Security Best Practices

1. **Never commit secrets to git**
   - Use Secret Manager
   - Add `.env` to `.gitignore`

2. **Use Workload Identity Federation**
   - No service account keys in GitHub
   - More secure than static credentials

3. **Restrict service accounts**
   - Grant minimum necessary permissions
   - Use separate service accounts per service

4. **Enable VPC for production**
   ```bash
   gcloud run services update SERVICE_NAME \
     --region us-central1 \
     --vpc-connector CONNECTOR_NAME
   ```

5. **Set up billing alerts**
   ```bash
   gcloud billing budgets create \
     --billing-account BILLING_ACCOUNT_ID \
     --display-name "Kyarafit Budget" \
     --budget-amount 100USD
   ```

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Artifact Registry Guide](https://cloud.google.com/artifact-registry/docs)
- [Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Next.js on Cloud Run](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nextjs-service)

## 🆘 Support

If you encounter issues:

1. Check this documentation
2. Review Cloud Run logs
3. Consult [troubleshooting](#troubleshooting) section
4. Open an issue on GitHub

## 📝 Manual Setup (Detailed)

### 1. Create GCP Project

```bash
# Create project
gcloud projects create kyarafit --name="Kyarafit"

# Set as active project
gcloud config set project kyarafit

# Enable billing (required)
# Visit: https://console.cloud.google.com/billing
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com
```

### 3. Create Artifact Registry

```bash
gcloud artifacts repositories create kyarafit \
  --repository-format=docker \
  --location=us-central1 \
  --description="Kyarafit Docker images"
```

### 4. Set Up Workload Identity Federation

```bash
# Create pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

### 5. Create Service Account

```bash
# Create account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding kyarafit \
  --member="serviceAccount:github-actions@kyarafit.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding kyarafit \
  --member="serviceAccount:github-actions@kyarafit.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 6. Configure GitHub

Add secrets to GitHub repository:
- Settings > Secrets and variables > Actions
- Add `GCP_WIF_PROVIDER` and `GCP_SERVICE_ACCOUNT`

---

**Built with ❤️ for the cosplay community**
