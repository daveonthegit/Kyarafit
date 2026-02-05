# 📋 Kyarafit GCP Deployment Checklist

Use this checklist to deploy Kyarafit to Google Cloud Platform step by step.

## Phase 1: Pre-Deployment Setup

### ✅ GCP Account Setup

- [ ] Create Google Cloud account
- [ ] Enable billing
- [ ] Install gcloud CLI
- [ ] Authenticate: `gcloud auth login`

### ✅ Supabase Configuration

- [ ] Have Supabase project URL
- [ ] Have database connection string
- [ ] Have JWT secret
- [ ] Have service role key
- [ ] Verify database is accessible
- [ ] Verify storage bucket exists

### ✅ Domain Setup (Optional)

- [ ] Own domain (kyarafit.com)
- [ ] Have access to DNS settings
- [ ] Ready to add DNS records

### ✅ SMTP/Email Setup

- [ ] Choose email provider (Resend recommended)
- [ ] Have SMTP credentials
- [ ] Verify email sending works

## Phase 2: GCP Project Setup

### ✅ Run Setup Script

```bash
# Windows
.\scripts\setup-gcp.ps1

# Mac/Linux
chmod +x scripts/*.sh
./scripts/setup-gcp.sh
```

Verify:

- [ ] GCP project "kyarafit" created
- [ ] APIs enabled (Run, Artifact Registry, Secret Manager)
- [ ] Artifact Registry repository created
- [ ] Service account created
- [ ] Workload Identity Federation configured
- [ ] GitHub secrets values provided

### ✅ Create GCP Secrets

```bash
# Copy and fill in your actual values from .env.gcp.example
echo -n "YOUR_VALUE" | gcloud secrets create SECRET_NAME --data-file=-
```

- [ ] `database-url` (Supabase PostgreSQL connection string)
- [ ] `supabase-url` (https://[PROJECT].supabase.co)
- [ ] `jwt-secret` (from Supabase settings)
- [ ] `supabase-service-key` (from Supabase settings)
- [ ] `auth-secret` (generated random string)
- [ ] `smtp-host` (e.g., smtp.resend.com)
- [ ] `smtp-port` (e.g., 587)
- [ ] `smtp-username` (e.g., resend)
- [ ] `smtp-password` (API key)
- [ ] `smtp-from` (e.g., Kyarafit <noreply@kyarafit.com>)

Verify secrets:

```bash
gcloud secrets list
```

### ✅ Configure GitHub

- [ ] Go to GitHub repo settings
- [ ] Navigate to: Settings > Secrets and variables > Actions
- [ ] Add `GCP_WIF_PROVIDER` (from setup script output)
- [ ] Add `GCP_SERVICE_ACCOUNT` (from setup script output)

## Phase 3: First Deployment

### ✅ Deploy All Services

```bash
# Windows
.\scripts\deploy-all.ps1

# Mac/Linux
./scripts/deploy-all.sh
```

- [ ] Image service deployed successfully
- [ ] Backend deployed successfully
- [ ] Web frontend deployed successfully
- [ ] Got Cloud Run URLs for all services

### ✅ Test Services

```bash
# Get service URLs
gcloud run services list --region us-central1
```

- [ ] Backend health check: `curl https://BACKEND_URL/health`
- [ ] Web frontend loads: Open `https://WEB_URL` in browser
- [ ] Image service responds: `curl https://IMAGE_SERVICE_URL/health`
- [ ] View logs: `gcloud run logs read kyarafit-backend --region us-central1`

### ✅ Verify Functionality

- [ ] Can access web frontend
- [ ] Can create account / login
- [ ] Can add items to closet
- [ ] Image upload works
- [ ] Background removal works (if enabled)
- [ ] Database operations work
- [ ] Email sending works (test forgot password)

## Phase 4: Custom Domain Setup (Optional)

### ✅ Map Domains

```bash
./scripts/setup-domains.sh
```

- [ ] www.kyarafit.com mapped to web service
- [ ] kyarafit.com (root) mapped to web service
- [ ] api.kyarafit.com mapped to backend
- [ ] images.kyarafit.com mapped to image service

### ✅ Configure DNS

- [ ] Get DNS records from GCP (script output)
- [ ] Add A records to domain registrar
- [ ] Add AAAA records (IPv6) if provided
- [ ] Wait 15-60 minutes for propagation

### ✅ Verify DNS

```bash
# Check DNS propagation
dig www.kyarafit.com
nslookup api.kyarafit.com
```

- [ ] DNS records resolve to correct IPs
- [ ] All subdomains working
- [ ] SSL certificates provisioned (can take up to 60 min)
- [ ] HTTPS working on all domains

### ✅ Update Application URLs

After custom domains are working:

- [ ] Update mobile app with production URLs
- [ ] Update any hardcoded URLs in code
- [ ] Test mobile app against production API

## Phase 5: CI/CD Verification

### ✅ Test Automated Deployment

Make a small change and push to main:

```bash
git add .
git commit -m "Test GCP deployment"
git push origin main
```

- [ ] GitHub Actions workflow triggered
- [ ] Backend workflow completed successfully
- [ ] Web workflow completed successfully
- [ ] Image service workflow completed successfully
- [ ] Services updated on Cloud Run
- [ ] No downtime during deployment

### ✅ Verify GitHub Actions

- [ ] Check Actions tab in GitHub
- [ ] Review deployment logs
- [ ] Verify new revision deployed
- [ ] Test updated services

## Phase 6: Monitoring & Alerts

### ✅ Set Up Billing Alerts

```bash
gcloud billing budgets create \
  --billing-account YOUR_BILLING_ACCOUNT_ID \
  --display-name "Kyarafit Budget" \
  --budget-amount 100USD
```

- [ ] Billing alert created
- [ ] Alert email configured
- [ ] Test alert triggers

### ✅ Configure Monitoring

- [ ] Set up uptime checks in Cloud Console
- [ ] Configure error reporting
- [ ] Set up log-based metrics
- [ ] Create monitoring dashboard

### ✅ Set Up Notifications

- [ ] Cloud Run deployment notifications
- [ ] Error alerts
- [ ] Budget alerts
- [ ] Uptime check failures

## Phase 7: Production Readiness

### ✅ Performance Testing

- [ ] Load test backend API
- [ ] Test concurrent users
- [ ] Verify auto-scaling works
- [ ] Check cold start times
- [ ] Monitor memory usage
- [ ] Check CPU usage

### ✅ Security Review

- [ ] Secrets not in code
- [ ] CORS configured correctly
- [ ] HTTPS enforced
- [ ] Service accounts have minimal permissions
- [ ] No public access to secrets
- [ ] Database connections secure (SSL)

### ✅ Backup Strategy

- [ ] Database backup configured (Supabase handles this)
- [ ] Storage backup strategy (Supabase)
- [ ] Document recovery procedures
- [ ] Test restore process

### ✅ Documentation

- [ ] Document deployment process
- [ ] Document environment variables
- [ ] Document service URLs
- [ ] Document DNS configuration
- [ ] Create runbook for common issues
- [ ] Train team on deployment process

## Phase 8: Go Live!

### ✅ Pre-Launch Checklist

- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Monitoring in place
- [ ] Backup strategy confirmed
- [ ] Team trained
- [ ] Support plan ready

### ✅ Launch

- [ ] Update DNS to point to production (if using staging)
- [ ] Announce launch
- [ ] Monitor closely for first 24 hours
- [ ] Check error rates
- [ ] Watch costs

### ✅ Post-Launch

- [ ] Monitor for 1 week
- [ ] Review costs
- [ ] Gather user feedback
- [ ] Address any issues
- [ ] Optimize based on usage patterns

## 🎉 Congratulations!

Your Kyarafit application is now running on GCP Cloud Run!

## 📊 Ongoing Maintenance

### Weekly

- [ ] Review logs for errors
- [ ] Check costs vs budget
- [ ] Review performance metrics

### Monthly

- [ ] Review and optimize costs
- [ ] Update dependencies
- [ ] Review security
- [ ] Backup verification

### Quarterly

- [ ] Major dependency updates
- [ ] Security audit
- [ ] Performance review
- [ ] Capacity planning

## 🆘 Troubleshooting

If anything goes wrong, see:

- `docs/GCP_DEPLOYMENT.md` - Full troubleshooting guide
- Cloud Run logs: `gcloud run logs read SERVICE_NAME`
- GitHub Actions logs: Check Actions tab
- GCP Console: https://console.cloud.google.com

## 📞 Support Resources

- **Documentation**: `docs/GCP_DEPLOYMENT.md`
- **Quick Start**: `docs/GCP_QUICKSTART.md`
- **GCP Support**: https://cloud.google.com/support
- **Community**: GitHub Discussions

---

**✅ Deployment Complete!**

Keep this checklist for future reference and deployments.
