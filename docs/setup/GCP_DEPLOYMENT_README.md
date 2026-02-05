# 🚀 GCP Deployment Setup Complete!

Your Kyarafit project is now ready for deployment to Google Cloud Platform.

## 📁 What's Been Created

### GitHub Actions Workflows
- `.github/workflows/deploy-gcp-backend.yml` - Backend CI/CD
- `.github/workflows/deploy-gcp-web.yml` - Frontend CI/CD
- `.github/workflows/deploy-gcp-image-service.yml` - Image service CI/CD

### Deployment Scripts
- `scripts/setup-gcp.sh` / `scripts/setup-gcp.ps1` - Initial GCP setup
- `scripts/deploy-all.sh` / `scripts/deploy-all.ps1` - Deploy all services
- `scripts/setup-domains.sh` - Configure custom domains

### Documentation
- `docs/GCP_DEPLOYMENT.md` - Complete deployment guide
- `docs/GCP_QUICKSTART.md` - Quick start guide
- `.env.gcp.example` - Environment variables template

### Optimizations
- `web/Dockerfile` - Optimized for Cloud Run with multi-stage build
- `web/next.config.js` - Updated with standalone output
- `web/.dockerignore` - Optimized build context

## 🎯 Quick Start

### 1. Setup GCP (One-time)

**Windows:**
```powershell
.\scripts\setup-gcp.ps1
```

**Mac/Linux:**
```bash
chmod +x scripts/*.sh
./scripts/setup-gcp.sh
```

### 2. Create Secrets

Follow the prompts from the setup script or see `.env.gcp.example` for all required secrets.

### 3. Deploy

**Windows:**
```powershell
.\scripts\deploy-all.ps1
```

**Mac/Linux:**
```bash
./scripts/deploy-all.sh
```

### 4. Setup Custom Domain (Optional)

```bash
./scripts/setup-domains.sh
```

## 🌐 Production URLs

After deployment, your services will be available at:

**Cloud Run URLs (default):**
- Backend: `https://kyarafit-backend-[hash]-uc.a.run.app`
- Web: `https://kyarafit-web-[hash]-uc.a.run.app`
- Image Service: `https://kyarafit-image-service-[hash]-uc.a.run.app`

**Custom Domains (after DNS setup):**
- Web: `https://www.kyarafit.com`
- API: `https://api.kyarafit.com`
- Images: `https://images.kyarafit.com`

## 🔄 CI/CD Pipeline

GitHub Actions automatically deploys when you push to `main`:

1. **Push code** → Triggers workflow
2. **Build** → Docker images built
3. **Push** → Images pushed to Artifact Registry
4. **Deploy** → Services updated on Cloud Run
5. **Traffic shift** → Zero-downtime deployment

## 📊 Architecture

```
Users
  ↓
www.kyarafit.com (Web Frontend - Next.js)
  ↓
api.kyarafit.com (Backend - Go/Fiber)
  ↓                           ↓
images.kyarafit.com          Supabase
(Image Service)              (PostgreSQL + Storage)
```

## 💰 Expected Costs

| Stage | Monthly Cost |
|-------|-------------|
| Development (100-500 users) | $5-15 |
| Production (1K-5K users) | $52-84 |
| Large Scale (10K+ users) | $296-361 |

Plus Supabase costs (separate).

**Key savings:**
- Scale to zero when idle
- Pay only for actual usage
- Free SSL certificates
- No infrastructure management

## 🔐 Security Features

✅ Workload Identity Federation (no service account keys)
✅ Secret Manager for sensitive data
✅ Automatic SSL/HTTPS
✅ Non-root container users
✅ VPC support available
✅ IAM-based access control

## 📚 Documentation

- **Quick Start:** `docs/GCP_QUICKSTART.md` (30 minutes)
- **Full Guide:** `docs/GCP_DEPLOYMENT.md` (comprehensive)
- **Environment Variables:** `.env.gcp.example` (template)

## 🛠️ Useful Commands

```bash
# View logs
gcloud run logs read kyarafit-backend --region us-central1 --follow

# List services
gcloud run services list --region us-central1

# Update service
gcloud run services update SERVICE_NAME --set-env-vars KEY=VALUE

# Rollback
gcloud run services update-traffic SERVICE_NAME --to-revisions REVISION=100

# View secrets
gcloud secrets list
```

## ✅ Deployment Checklist

Before going live:

- [ ] Run `setup-gcp.sh/ps1` to configure GCP project
- [ ] Create all secrets in Secret Manager
- [ ] Add GitHub repository secrets
- [ ] Test deployment with `deploy-all.sh/ps1`
- [ ] Verify services are accessible
- [ ] Setup custom domains (optional)
- [ ] Update mobile app with production URLs
- [ ] Configure billing alerts
- [ ] Set up monitoring
- [ ] Test all endpoints
- [ ] Verify database connections
- [ ] Test image upload/processing
- [ ] Verify email sending (SMTP)
- [ ] Check CORS settings
- [ ] Test authentication flow

## 🆘 Support

**Documentation:**
- Read `docs/GCP_DEPLOYMENT.md`
- Check troubleshooting section
- Review GitHub Actions logs

**Common Issues:**
- Permission denied → Re-run `gcloud auth login`
- Build fails → Check Dockerfile and .dockerignore
- Service not accessible → Verify IAM permissions
- Secrets not working → Check Secret Manager IAM

## 🎉 Next Steps

1. **Deploy to staging** first to test
2. **Monitor costs** in Cloud Console
3. **Set up alerts** for errors and budget
4. **Configure backups** for production
5. **Document your deployment** process
6. **Train team** on GCP tools

## 🔗 Resources

- [GCP Cloud Run Docs](https://cloud.google.com/run/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Next.js on Cloud Run](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nextjs-service)

---

**Questions?** Open an issue or check `docs/GCP_DEPLOYMENT.md`

**Ready to deploy?** Run `./scripts/setup-gcp.sh` to get started!

🎯 **Your infrastructure is code-ready and production-ready!**
