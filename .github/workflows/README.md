# GitHub Actions Workflows

This directory contains the GitHub Actions workflows for CI. The stack is
TypeScript-only: a Next.js **web** app, an Expo **mobile** app, a shared
**design-system**, and a **Convex** backend.

## ✅ Workflows

| Workflow     | Status    | Purpose                                                               |
| ------------ | --------- | --------------------------------------------------------------------- |
| `ci.yml`     | ✅ Active | Main CI — orchestrates web + mobile CI, security scan, build summary  |
| `web.yml`    | ✅ Active | Web frontend CI (ESLint, TypeScript check, tests). Reusable workflow. |
| `mobile.yml` | ✅ Active | Mobile app CI (ESLint, TypeScript check, tests). Reusable workflow.   |

### `ci.yml` — Main CI

- Triggers: push / pull_request on `main` and `develop`, plus manual dispatch
- Calls the reusable `web.yml` and `mobile.yml` workflows
- Runs a **security scan** on pull requests: Gitleaks (secrets), Trivy
  (vulnerabilities), `npm audit`
- Publishes a build summary

### `web.yml` — Web Frontend CI

- Triggers: changes to `web/`, `convex/`, `design-system/`
- Runs: ESLint, TypeScript check, tests
- Deployment is handled by **Vercel** preview builds (not this workflow)

### `mobile.yml` — Mobile App CI

- Triggers: changes to `mobile/`
- Runs: ESLint, TypeScript check, tests
- Validates the Expo build

## 🚀 Deployment

- **Backend**: Convex — `npx convex deploy`
- **Web**: Vercel preview/production builds
- The `scripts/deploy-all.sh` / `.ps1` helpers can also deploy the web app to
  GCP Cloud Run if that target is used.

## 🔒 Required Secrets

- `GITLEAKS_LICENSE` — optional, for the Gitleaks scanner
- `CODECOV_TOKEN` — optional, for coverage reporting

## 🐛 Troubleshooting

1. Check the workflow logs in the GitHub Actions tab
2. Reproduce locally with `make validate` (see [CI_LOCAL.md](../../CI_LOCAL.md))
3. Verify any required secrets are configured

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- Local CI guide: [CI_LOCAL.md](../../CI_LOCAL.md)
