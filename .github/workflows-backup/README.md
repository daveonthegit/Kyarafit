# Backup Workflows

This folder contains disabled deployment workflows that have been replaced by GCP Cloud Run deployment.

## Disabled Workflows

### `deploy-fly.yml.disabled`
- **Original Purpose**: Deploy to Fly.io
- **Disabled Date**: 2025
- **Reason**: Migrated to GCP Cloud Run
- **Replacement**: `.github/workflows/deploy-gcp-*.yml`

To re-enable Fly.io deployment:
1. Rename to `.yml` extension
2. Move back to `.github/workflows/`
3. Disable GCP workflows to avoid conflicts

### `deploy-render.yml.disabled`
- **Original Purpose**: Deploy to Render
- **Disabled Date**: 2025
- **Reason**: Migrated to GCP Cloud Run
- **Replacement**: `.github/workflows/deploy-gcp-*.yml`

To re-enable Render deployment:
1. Rename to `.yml` extension
2. Move back to `.github/workflows/`
3. Disable GCP workflows to avoid conflicts

## Active Workflows

The following workflows are still active in `.github/workflows/`:

### CI/CD (GCP Deployment)
- `deploy-gcp-backend.yml` - Backend deployment to Cloud Run
- `deploy-gcp-web.yml` - Web frontend deployment to Cloud Run
- `deploy-gcp-image-service.yml` - Image service deployment to Cloud Run

### Testing & Validation
- `backend.yml` - Backend CI (tests, linting, build)
- `web.yml` - Web frontend CI
- `image-service.yml` - Image service CI
- `mobile.yml` - Mobile app CI
- `ci.yml` - General CI checks
- `pr-checks.yml` - Pull request validation

## Migration Notes

**Why GCP Cloud Run?**
- Better auto-scaling (scale to zero)
- Lower costs for development
- Integrated with existing infrastructure
- Automatic SSL certificates
- Better monitoring and logging

**Cost Comparison:**
- Fly.io: ~$5-20/month (always running)
- Render: ~$7-25/month (always running)
- GCP Cloud Run: $5-15/month (scale to zero)

**Rollback Plan:**
If you need to rollback to Fly.io or Render:
1. Move workflow back to `.github/workflows/`
2. Rename to `.yml`
3. Ensure secrets are still configured
4. Disable GCP workflows

## Preserving for Future Reference

These workflows are kept for:
- Historical reference
- Alternative deployment options
- Emergency rollback capability
- Learning/comparison purposes

To permanently delete: `rm -rf .github/workflows-backup`
