# GCP Deployment Quickstart

Get Kyarafit running on GCP Cloud Run in under 30 minutes.

## ⚡ Prerequisites (5 minutes)

- [ ] Google Cloud account with billing enabled
- [ ] `gcloud` CLI installed ([install](https://cloud.google.com/sdk/docs/install))
- [ ] GitHub repository access
- [ ] Supabase project with credentials ready

## 🚀 Deployment Steps

### 1. Setup GCP Project (10 minutes)

```bash
# Windows
.\scripts\setup-gcp.ps1

# Mac/Linux
chmod +x scripts/setup-gcp.sh
./scripts/setup-gcp.sh
```

This creates:
- GCP project "kyarafit"
- Artifact Registry for Docker images
- Service accounts for deployment
- Workload Identity Federation for GitHub

### 2. Create Secrets (5 minutes)

Copy your Supabase credentials and create secrets:

```bash
# Get these from Supabase Dashboard > Project Settings > API
echo -n "postgresql://..." | gcloud secrets create database-url --data-file=-
echo -n "https://xxx.supabase.co" | gcloud secrets create supabase-url --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "your-service-key" | gcloud secrets create supabase-service-key --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create auth-secret --data-file=-
```

### 3. Add GitHub Secrets (2 minutes)

Add these to GitHub (Settings > Secrets and variables > Actions):

The setup script output will show you the values for:
- `GCP_WIF_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

### 4. Deploy Services (5 minutes)

```bash
# Windows
.\scripts\deploy-all.ps1

# Mac/Linux
chmod +x scripts/deploy-all.sh
./scripts/deploy-all.sh
```

This deploys:
- Backend API
- Web Frontend  
- Image Service

### 5. Setup Custom Domain (5 minutes) - Optional

```bash
# Map domains to services
chmod +x scripts/setup-domains.sh
./scripts/setup-domains.sh

# Add DNS records shown in output to your domain registrar
# Wait 15-60 minutes for DNS propagation
```

## ✅ Verify Deployment

```bash
# Check services are running
gcloud run services list --region us-central1

# Test backend
curl https://BACKEND_URL/health

# View logs
gcloud run logs read kyarafit-backend --region us-central1 --limit 20
```

## 🎉 You're Done!

Your services are now live:
- **Backend**: `https://kyarafit-backend-xxx.a.run.app`
- **Web**: `https://kyarafit-web-xxx.a.run.app`
- **Image Service**: `https://kyarafit-image-service-xxx.a.run.app`

With custom domains (after DNS propagation):
- **Web**: `https://www.kyarafit.com`
- **API**: `https://api.kyarafit.com`
- **Images**: `https://images.kyarafit.com`

## 🔄 CI/CD is Automatic

Push to `main` branch, and GitHub Actions will automatically deploy!

## 📊 Monitor Costs

Set up billing alert:
```bash
gcloud billing budgets create \
  --billing-account YOUR_BILLING_ACCOUNT_ID \
  --display-name "Kyarafit Budget" \
  --budget-amount 100USD
```

## 🆘 Need Help?

- Full docs: [docs/GCP_DEPLOYMENT.md](./GCP_DEPLOYMENT.md)
- Troubleshooting: See [GCP_DEPLOYMENT.md#troubleshooting](./GCP_DEPLOYMENT.md#troubleshooting)
- Open an issue on GitHub

## 💰 Expected Costs

- **Development** (100-500 users): $5-15/month
- **Production** (1K-5K users): $52-84/month
- **Scale to zero** when idle = no costs!

---

**Next Steps:**
- Update mobile app with production API URLs
- Set up monitoring alerts
- Configure backup strategy
- Test all endpoints
