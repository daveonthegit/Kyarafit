# GCP Setup Summary

Complete GCP deployment infrastructure created for Kyarafit!

## 📦 Files Created

### GitHub Actions Workflows

```
.github/workflows/
├── deploy-gcp-backend.yml        # Backend CI/CD
├── deploy-gcp-web.yml            # Frontend CI/CD
└── deploy-gcp-image-service.yml  # Image service CI/CD
```

### Deployment Scripts

```
scripts/
├── setup-gcp.sh                  # GCP project setup (Linux/Mac)
├── setup-gcp.ps1                 # GCP project setup (Windows)
├── deploy-all.sh                 # Deploy all services (Linux/Mac)
├── deploy-all.ps1                # Deploy all services (Windows)
└── setup-domains.sh              # Configure custom domains
```

### Documentation

```
docs/
├── GCP_DEPLOYMENT.md             # Complete deployment guide
├── GCP_QUICKSTART.md             # 30-minute quick start
└── setup/
    └── GCP_SETUP_SUMMARY.md      # This file
```

### Configuration

```
.env.gcp.example                  # Environment variables template
GCP_DEPLOYMENT_README.md          # Overview and quick reference
DEPLOYMENT_CHECKLIST.md           # Step-by-step deployment checklist
```

### Optimizations

```
web/
├── Dockerfile                    # Optimized multi-stage build
├── next.config.js                # Updated with standalone output
└── .dockerignore                 # Build optimization
```

## 🚀 Getting Started

### 1. Initial Setup (One-time)

**Windows:**

```powershell
cd c:\Users\darkf\Documents\Kyarafit
.\scripts\setup-gcp.ps1
```

**Mac/Linux:**

```bash
cd ~/Documents/Kyarafit  # adjust path as needed
chmod +x scripts/*.sh
./scripts/setup-gcp.sh
```

### 2. Add GitHub Secrets

The setup script will output these values:

- `GCP_WIF_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

Add them to: GitHub repo > Settings > Secrets and variables > Actions

### 3. Create GCP Secrets

Use the template in `.env.gcp.example`:

```bash
# Example:
echo -n "postgresql://..." | gcloud secrets create database-url --data-file=-
echo -n "https://xxx.supabase.co" | gcloud secrets create supabase-url --data-file=-
# ... etc (see .env.gcp.example for all)
```

### 4. Deploy

**Windows:**

```powershell
.\scripts\deploy-all.ps1
```

**Mac/Linux:**

```bash
./scripts/deploy-all.sh
```

### 5. Setup Custom Domain (Optional)

```bash
./scripts/setup-domains.sh
```

## 🎯 What You Get

### Automated CI/CD

- Push to `main` → Automatic deployment
- Zero-downtime updates
- Automatic rollback on failure
- Build caching for faster deploys

### Infrastructure

- **Backend**: Go API on Cloud Run
- **Frontend**: Next.js on Cloud Run
- **Image Service**: Python/FastAPI on Cloud Run
- **Database**: Supabase PostgreSQL (existing)
- **Storage**: Supabase Storage (existing)

### Cost Optimization

- Scale to zero when idle
- Multi-stage Docker builds (smaller images)
- Automatic caching
- Regional deployment (us-central1 = cheapest)

### Security

- Workload Identity Federation (no keys)
- Secret Manager for sensitive data
- Automatic SSL/HTTPS
- Non-root containers
- Minimal IAM permissions

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│ GitHub                                                  │
│ ├─ Push to main                                         │
│ └─ Triggers GitHub Actions                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions (CI/CD)                                  │
│ ├─ Build Docker images                                  │
│ ├─ Push to Artifact Registry                            │
│ └─ Deploy to Cloud Run                                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ GCP Cloud Run (Production)                              │
│ ├─ kyarafit-backend (api.kyarafit.com)                 │
│ ├─ kyarafit-web (www.kyarafit.com)                     │
│ └─ kyarafit-image-service (images.kyarafit.com)        │
└─────────────────────────────────────────────────────────┘
          ↓                           ↓
┌──────────────────────┐    ┌──────────────────────────┐
│ GCP Services         │    │ Supabase                 │
│ ├─ Artifact Registry │    │ ├─ PostgreSQL            │
│ ├─ Secret Manager    │    │ ├─ Storage               │
│ └─ Cloud Build       │    │ └─ Auth                  │
└──────────────────────┘    └──────────────────────────┘
```

## 💰 Cost Estimates

| Stage       | Users   | Monthly Cost |
| ----------- | ------- | ------------ |
| Development | 100-500 | $5-15        |
| Growth      | 1K-5K   | $52-84       |
| Scale       | 10K+    | $296-361     |

**Note:** Costs scale with usage. Services scale to zero when idle = no costs!

## 🛠️ Key Commands

```bash
# Deploy all services
./scripts/deploy-all.sh

# View logs
gcloud run logs read kyarafit-backend --region us-central1 --follow

# List services
gcloud run services list --region us-central1

# Update environment variable
gcloud run services update kyarafit-backend \
  --region us-central1 \
  --update-env-vars KEY=VALUE

# Check domain status
gcloud run domain-mappings list --region us-central1

# View secrets
gcloud secrets list
```

## 📚 Documentation Guide

1. **Start here**: `GCP_DEPLOYMENT_README.md` - Overview
2. **Quick deploy**: `docs/GCP_QUICKSTART.md` - 30 min guide
3. **Full details**: `docs/GCP_DEPLOYMENT.md` - Complete guide
4. **Step-by-step**: `DEPLOYMENT_CHECKLIST.md` - Detailed checklist
5. **Reference**: `.env.gcp.example` - All environment variables

## ✅ Pre-Deployment Checklist

Before running scripts, ensure you have:

- [ ] GCP account with billing enabled
- [ ] `gcloud` CLI installed and authenticated
- [ ] Supabase project with credentials ready
- [ ] GitHub repository access
- [ ] Domain name (optional, for custom domains)
- [ ] SMTP credentials for email (Resend recommended)

## 🎉 Success Criteria

After deployment, you should have:

✅ Three services running on Cloud Run
✅ Automatic CI/CD via GitHub Actions
✅ Secure secrets in Secret Manager
✅ Custom domains configured (optional)
✅ SSL/HTTPS working
✅ Auto-scaling enabled
✅ Monitoring and logging active
✅ Cost alerts configured

## 🆘 Troubleshooting

If you encounter issues:

1. **Check logs**: `gcloud run logs read SERVICE_NAME --region us-central1`
2. **Review docs**: See `docs/GCP_DEPLOYMENT.md#troubleshooting`
3. **Verify setup**: Ensure all secrets are created
4. **Check GitHub**: Review Actions logs for errors
5. **Test locally**: Verify Docker builds work locally

Common issues:

- **Permission denied**: Run `gcloud auth login`
- **Secret not found**: Create missing secrets
- **Build fails**: Check Dockerfile and .dockerignore
- **Service not accessible**: Verify IAM permissions

## 🔗 Useful Links

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Artifact Registry](https://cloud.google.com/artifact-registry)
- [Secret Manager](https://cloud.google.com/secret-manager)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Next.js on Cloud Run](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nextjs-service)

## 📞 Support

- **Documentation**: Check `docs/` folder
- **Issues**: Open GitHub issue
- **GCP Support**: https://cloud.google.com/support

---

## 🎯 Next Steps

1. ✅ **Run setup script**: `./scripts/setup-gcp.sh`
2. ✅ **Create secrets**: Follow `.env.gcp.example`
3. ✅ **Add GitHub secrets**: From setup script output
4. ✅ **Deploy**: `./scripts/deploy-all.sh`
5. ✅ **Test**: Verify all services work
6. ✅ **Custom domain**: `./scripts/setup-domains.sh` (optional)
7. ✅ **Monitor**: Set up alerts and dashboards

**Your production infrastructure is ready! 🚀**

Questions? Check `docs/GCP_DEPLOYMENT.md` or open an issue.
