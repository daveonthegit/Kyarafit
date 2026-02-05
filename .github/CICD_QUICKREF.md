# CI/CD Quick Reference

## 🚀 Before You Push

```bash
# Run this to catch issues early (2-5 min)
make validate

# Or using npm
npm run validate
```

This runs everything CI will check:
- ✅ Code formatting
- ✅ Linting (all services)
- ✅ Type checking
- ✅ Builds (web, backend, image-service)
- ✅ Tests

---

## 🔧 Quick Fixes

### Formatting Issues

```bash
# Auto-fix all formatting
make format

# Or per workspace
cd web && npm run format
cd mobile && npm run format
```

### Linting Issues

```bash
# Check all
make lint

# Fix Go formatting
cd backend && gofmt -s -w .

# Fix Python formatting
cd image-service && black . && isort .
```

### Type Errors

```bash
# Check types
make typecheck

# Rebuild dependencies if needed
npm install
cd backend && go mod tidy
```

---

## 📊 What CI Checks

### On Every PR

1. **Linting**: ESLint, golangci-lint, flake8, black, isort
2. **Type Checking**: TypeScript (web, mobile, design-system)
3. **Formatting**: Prettier, gofmt, black
4. **Tests**: Go tests, Python tests (web/mobile tests when available)
5. **Builds**: Next.js, Go binary, Docker images
6. **Security**: Gitleaks (secrets), Trivy (vulns), npm audit

### On Push to Main (after CI passes)

1. All PR checks
2. **Deploy to GCP Cloud Run** (backend, web, image-service)
3. **Smoke tests** (health checks)
4. **Rollback instructions** in summary

---

## 🔐 Security Scans

### Secret Scanning (Gitleaks)

Automatically scans for:
- API keys
- Tokens
- Passwords
- Private keys
- AWS credentials
- etc.

**Fails CI immediately if secrets found.**

### Vulnerability Scanning

- **Trivy**: Scans dependencies for known CVEs
- **npm audit**: Checks JavaScript packages (critical level)
- **safety**: Checks Python packages
- **gosec**: Scans Go code for security issues

---

## 📁 Files Changed

### New Configuration Files

- `backend/.golangci.yml` - Go linter config
- `.prettierrc` - Formatting rules
- `CI_LOCAL.md` - Full CI documentation
- `CI_CD_IMPROVEMENTS.md` - Change summary
- `Makefile` - Enhanced with 30+ commands

### Updated Workflows

- `.github/workflows/ci.yml` - Added secret scanning
- `.github/workflows/deploy-*.yml` - Added safety controls
- `.github/workflows/mobile.yml` - Fixed formatting check

### Updated Scripts

- `package.json` (root) - Added validate, typecheck, format:check
- `web/package.json` - Added typecheck, format scripts
- `mobile/package.json` - Added typecheck, format scripts
- `design-system/package.json` - Added all scripts

---

## 🎯 Common Commands

```bash
# Development
make dev                # Start all services
make dev-backend        # Backend only
make dev-web            # Web only

# Quality Checks
make lint               # Lint everything
make typecheck          # Type check everything
make format-check       # Check formatting

# Testing
make test               # All tests
make test-backend       # Backend tests (needs Docker)

# Full CI Validation
make validate           # Run everything CI runs
```

---

## 🆘 Troubleshooting

### "Secret detected by Gitleaks"

- Review the detected secret in CI logs
- Remove or replace with environment variable
- Never commit real credentials

### "Prettier check failed"

```bash
npm run format
git add -u
git commit --amend --no-edit
```

### "TypeScript errors"

```bash
# Clean install
rm -rf node_modules
npm install

# Check the specific error
npm run typecheck
```

### "Go formatting failed"

```bash
cd backend
gofmt -s -w .
git add -u
git commit --amend --no-edit
```

### "Tests failing locally but Docker not running"

```bash
# Start Docker services
make docker-up

# Then run tests
make test-backend
```

---

## 📚 Full Documentation

- **CI_LOCAL.md** - Complete guide for running CI locally
- **CI_CD_IMPROVEMENTS.md** - All changes and improvements
- **README.md** - Updated with CI/CD commands

---

## ✅ Checklist Before Pushing

- [ ] Code formatted: `make format-check` ✅
- [ ] No lint errors: `make lint` ✅
- [ ] Types pass: `make typecheck` ✅
- [ ] Build succeeds: `make build` ✅
- [ ] Tests pass: `make test` ✅

**Or just run: `make validate`** ✅

---

**Remember**: If `make validate` passes, your PR will pass CI! 🎉
