# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD and automated testing.

## 🚀 Active Deployment Workflows (GCP Cloud Run)

### Production Deployment

These workflows deploy to GCP Cloud Run automatically on push to `main`:

- **`deploy-gcp-backend.yml`** - **Disabled** (backend is Convex; deploy via `npx convex deploy`)

- **`deploy-gcp-web.yml`** - Web frontend deployment
  - Triggers: Push to `main` (web changes)
  - Builds: Next.js application (Convex + Better Auth; no Go API)
  - Deploys to: Cloud Run (us-central1)
  - URL: `www.kyarafit.com`
  - **Required GitHub secrets:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` (from Convex dashboard; used as build-args)

- **`deploy-gcp-image-service.yml`** - Image processing service
  - Triggers: Push to `main` (image-service changes)
  - Builds: Python/FastAPI service
  - Deploys to: Cloud Run (us-central1)
  - URL: `images.kyarafit.com`

**Requirements:**

- GitHub Secrets: `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`
- GCP Secret Manager: `auth-secret` (Better Auth; referenced as `BETTER_AUTH_SECRET` in Cloud Run)

## ✅ CI/Testing Workflows

### Service-Specific CI

- **`backend.yml`** - **Disabled** (Go backend archived; app uses Convex)

- **`web.yml`** - Web frontend CI
  - Triggers: changes to `web/`, `convex/`, `design-system/`
  - Runs: ESLint, TypeScript check, tests
  - Build: Next.js production build (with Convex placeholder env vars)
  - Docker: Validates web image build

- **`image-service.yml`** - Image service CI
  - Runs: Python tests, linting
  - Validates: Dependencies and Docker build

- **`mobile.yml`** - Mobile app CI
  - Runs: React Native tests, linting
  - Validates: Expo build

### General CI

- **`ci.yml`** - Overall project CI
  - Runs: Web, image-service, mobile CI; integration smoke tests (image service); security scan; build summary
  - Backend: Convex (no Go backend job)

## 📦 Workflow Status

| Workflow                     | Status     | Purpose                             |
| ---------------------------- | ---------- | ----------------------------------- |
| deploy-gcp-backend.yml       | ⏸️ Disabled | Go backend archived (use Convex)    |
| deploy-gcp-web.yml           | ✅ Active  | Production web deployment           |
| deploy-gcp-image-service.yml | ✅ Active  | Production image service deployment |
| backend.yml                  | ⏸️ Disabled | Go backend archived                 |
| web.yml                      | ✅ Active  | Web CI (Convex + Next.js)           |
| image-service.yml            | ✅ Active  | Image service CI/testing            |
| mobile.yml                   | ✅ Active  | Mobile CI (Expo + Convex)           |
| ci.yml                       | ✅ Active  | General CI                          |

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
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL (for web deploy build; from Convex dashboard)
- `NEXT_PUBLIC_CONVEX_SITE_URL` - Convex HTTP/site URL (for web deploy build; from Convex dashboard)
- `CODECOV_TOKEN` - Code coverage reporting (optional)

#### GCP Secret Manager (for Cloud Run web service)

- `auth-secret` - Better Auth secret (referenced as `BETTER_AUTH_SECRET` in deploy-gcp-web.yml)

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
- **2026**: Backend replaced by **Convex** (database, auth via Better Auth). Go backend and `deploy-gcp-backend.yml` / `backend.yml` disabled. Web deploy uses Convex env vars; no Supabase/Go API.

---

For deployment documentation, see `docs/GCP_DEPLOYMENT.md`
