# Deployment preflight — operator runbook

The current application is Next.js + Expo + Convex/Better Auth. The Go backend, Python
image service, Supabase/Prisma setup, and multi-service Docker deployment described in older
guides are retired from this code line. Their documentation survives in Git history, not as
an executable deployment recipe. Do not run legacy `setup-gcp`, `deploy-all`, Supabase migration,
or domain-setup scripts based on their filenames alone.

## Before any rollout

An authorized operator must record, without secrets or user data:

- The actual web/mobile/backend targets and the exact deployed backend revision/lineage.
  `web/fly.toml` and historical hosting docs do not prove which host is live.
- Whether the candidate preserves the live schema and populated legacy table definitions.
  Never deploy an older main schema over a live feature-line deployment.
- Required provider configuration, credential custody, rollback revision, and backup/migration
  approval when a release changes persistent data. Repository deletion is not infrastructure retirement.
- The candidate's completed CI and authorized dev-environment checks. A pushed branch or PR
  alone is not evidence of a backend deployment or completed remediation.

## Development verification

Follow the [root README](../../README.md) for local setup, [CI_LOCAL.md](../../CI_LOCAL.md) for
validation commands, and [testing strategy](../TESTING.md) for live E2E requirements. Use only
an explicitly authorized development deployment and synthetic accounts; never production as a test target.

Transactional mail uses [Resend's API](../integrations/RESEND_SETUP.md), not SMTP. Existing auth
configuration is described in [auth.md](../auth.md); future auth changes must update it after
integration, not pre-announce a transport that is not yet implemented.

## Separate operator decisions

Deployment, DNS/provider changes, signing-key provisioning, credential rotation, infrastructure
retirement, destructive migration, and app-store publication require their own owner approval.
No command in a documentation cleanup or validation run grants that approval.
