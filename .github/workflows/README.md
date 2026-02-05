# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD and automated testing.

## 🚀 Active Deployment Workflows (GCP Cloud Run)

### Production Deployment
These workflows deploy to GCP Cloud Run automatically on push to `main`:

- **`deploy-gcp-backend.yml`** - Backend API deployment
  - Triggers: Push to `main` (backend changes)
  - Builds: Go/Fiber API
  - Deploys to: Cloud Run (us-central1)
  - URL: `api.kyarafit.com`

- **`deploy-gcp-web.yml`** - Web frontend deployment
  - Triggers: Push to `main` (web changes)
  - Builds: Next.js application
  - Deploys to: Cloud Run (us-central1)
  - URL: `www.kyarafit.com`

- **`deploy-gcp-image-service.yml`** - Image processing service
  - Triggers: Push to `main` (image-service changes)
  - Builds: Python/FastAPI service
  - Deploys to: Cloud Run (us-central1)
  - URL: `images.kyarafit.com`

**Requirements:**
- GitHub Secrets: `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`
- GCP Secrets: database-url, supabase-url, jwt-secret, etc.

## ✅ CI/Testing Workflows

### Service-Specific CI
- **`backend.yml`** - Backend testing and linting
  - Runs: Tests, go vet, golangci-lint
  - Coverage: Uploads to Codecov
  - Docker: Validates image builds

- **`web.yml`** - Web frontend CI
  - Runs: Tests, linting, type checking
  - Build: Validates production build

- **`image-service.yml`** - Image service CI
  - Runs: Python tests, linting
  - Validates: Dependencies and Docker build

- **`mobile.yml`** - Mobile app CI
  - Runs: React Native tests, linting
  - Validates: Expo build

### General CI
- **`ci.yml`** - Overall project CI
  - Runs: Multi-service validation
  - Checks: Code quality across all services

- **`pr-checks.yml`** - Pull request validation
  - Runs: On all PRs
  - Validates: Tests pass before merge

## 📦 Workflow Status

| Workflow | Status | Purpose |
|----------|--------|---------|
| deploy-gcp-backend.yml | ✅ Active | Production backend deployment |
| deploy-gcp-web.yml | ✅ Active | Production web deployment |
| deploy-gcp-image-service.yml | ✅ Active | Production image service deployment |
| backend.yml | ✅ Active | Backend CI/testing |
| web.yml | ✅ Active | Web CI/testing |
| image-service.yml | ✅ Active | Image service CI/testing |
| mobile.yml | ✅ Active | Mobile CI/testing |
| ci.yml | ✅ Active | General CI |
| pr-checks.yml | ✅ Active | PR validation |

## 🗄️ Disabled/Backup Workflows

Old deployment workflows have been moved to `.github/workflows-backup/`:
- `deploy-fly.yml.disabled` - Fly.io deployment (replaced by GCP)
- `deploy-render.yml.disabled` - Render deployment (replaced by GCP)

See `.github/workflows-backup/README.md` for details on re-enabling these.

## 🔧 Workflow Configuration

### Deployment Flow
```
Push to main
  ↓
GitHub Actions triggered
  ↓
Build Docker image
  ↓
Push to GCP Artifact Registry
  ↓
Deploy to Cloud Run
  ↓
Zero-downtime rollout
```

### Branch Strategy
- **`main`** - Production deployments (auto-deploy to GCP)
- **Feature branches** - CI checks only (no deployment)
- **Pull requests** - Full CI validation

### Secrets Required

#### GitHub Repository Secrets
- `GCP_WIF_PROVIDER` - Workload Identity Federation provider
- `GCP_SERVICE_ACCOUNT` - Service account email
- `CODECOV_TOKEN` - Code coverage reporting (optional)

#### GCP Secret Manager Secrets
- `database-url` - Supabase PostgreSQL connection
- `supabase-url` - Supabase project URL
- `jwt-secret` - JWT signing secret
- `supabase-service-key` - Supabase service role key
- `auth-secret` - Better Auth secret
- `smtp-host` - SMTP server
- `smtp-port` - SMTP port
- `smtp-username` - SMTP username
- `smtp-password` - SMTP password
- `smtp-from` - Email from address

## 🚦 Manual Deployment

To manually trigger deployment:

### Via GitHub UI
1. Go to Actions tab
2. Select workflow (e.g., deploy-gcp-backend.yml)
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

### Via GitHub CLI
```bash
gh workflow run deploy-gcp-backend.yml
gh workflow run deploy-gcp-web.yml
gh workflow run deploy-gcp-image-service.yml
```

## 📊 Monitoring Deployments

### View Workflow Runs
```bash
# List recent workflow runs
gh run list

# View specific run
gh run view RUN_ID

# Watch run in progress
gh run watch
```

### Check Deployment Status
```bash
# Via gcloud CLI
gcloud run services list --region us-central1

# View logs
gcloud run logs read kyarafit-backend --region us-central1
```

## 🐛 Troubleshooting

### Workflow Fails
1. Check workflow logs in GitHub Actions tab
2. Verify all secrets are configured
3. Check GCP service status
4. Review recent code changes

### Deployment Issues
1. Check Cloud Run logs: `gcloud run logs read SERVICE_NAME`
2. Verify secrets in Secret Manager
3. Check service configuration
4. Review deployment history

### Common Issues

**"Permission Denied"**
- Verify `GCP_WIF_PROVIDER` and `GCP_SERVICE_ACCOUNT` secrets
- Check Workload Identity Federation configuration
- Ensure service account has correct IAM roles

**"Secret not found"**
- Create missing secrets in GCP Secret Manager
- Grant Cloud Run access to secrets
- Verify secret names match workflow configuration

**"Build failed"**
- Check Dockerfile syntax
- Verify dependencies are available
- Review build logs in workflow output

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GCP Cloud Run CI/CD](https://cloud.google.com/run/docs/continuous-deployment)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)

## 🔄 Migration History

- **2025**: Migrated from Fly.io/Render to GCP Cloud Run
  - Reason: Better auto-scaling, lower costs, integrated infrastructure
  - Old workflows preserved in `workflows-backup/`
  - Zero-downtime migration completed

---

For deployment documentation, see `docs/GCP_DEPLOYMENT.md`
