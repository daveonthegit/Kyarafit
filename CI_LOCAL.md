# Running CI Checks Locally

This guide shows you how to run the same checks that GitHub Actions CI runs, **before** you push your code. This helps catch issues early and ensures your PR will pass CI.

## 🚀 Quick Start

Run all CI checks at once:

```bash
make validate
```

Or using npm:

```bash
npm run validate
```

This runs: format checking → linting → type checking → building → tests

---

## 📋 Prerequisites

### Required Tools

1. **Node.js 20+** and npm
2. **Go 1.21+**
3. **Python 3.11+**
4. **Docker** and Docker Compose (for services and tests)
5. **Make** (optional but recommended)

### Install Dependencies

```bash
# Install all dependencies at once
make install

# Or manually:
npm install                                  # Root + workspaces
cd backend && go mod download               # Go deps
cd image-service && pip install -r requirements.txt  # Python deps
```

---

## 🔍 Individual Check Commands

### 1. Code Formatting

**Check formatting (CI does this):**

```bash
make format-check
# or
npm run format:check
```

**Auto-fix formatting:**

```bash
make format
# or
npm run format
```

This checks/fixes:
- JavaScript/TypeScript (Prettier)
- Go (gofmt)
- Python (black, isort)

---

### 2. Linting

**Lint everything:**

```bash
make lint
```

**Lint specific services:**

```bash
make lint-web           # Next.js ESLint
make lint-mobile        # Expo ESLint
make lint-backend       # Go vet + golangci-lint
make lint-image-service # Python flake8 + black
```

**Install golangci-lint (backend):**

```bash
# macOS
brew install golangci-lint

# Linux
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin

# Windows
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

---

### 3. Type Checking

**Type check all TypeScript:**

```bash
make typecheck
# or
npm run typecheck
```

**Type check specific workspaces:**

```bash
npm run typecheck:web
npm run typecheck:mobile
```

---

### 4. Building

**Build everything:**

```bash
make build
```

**Build specific services:**

```bash
make build-web          # Next.js production build
make build-backend      # Go binary
make build-image-service # Python compile check
```

The web build is the **most important** - it catches TypeScript errors, missing imports, and Next.js config issues.

---

### 5. Testing

**Run all tests:**

```bash
make test
```

**Run specific test suites:**

```bash
make test-backend       # Go tests (needs Docker)
make test-web           # Web tests (when available)
make test-image-service # Python pytest
```

**Backend tests require Docker:**

```bash
# Start services first
make docker-up

# Then run tests
make test-backend
```

---

## 🔒 Security Checks

### Secret Scanning (Gitleaks)

CI runs Gitleaks to detect secrets in your code. To run locally:

```bash
# Install gitleaks
# macOS
brew install gitleaks

# Linux/Windows: Download from https://github.com/gitleaks/gitleaks/releases

# Run scan
gitleaks detect --source . --verbose
```

### Dependency Audits

```bash
# npm audit (checks for vulnerable packages)
npm audit --audit-level=critical

# Go security check (if installed)
cd backend && gosec ./...

# Python safety check (if installed)
cd image-service && safety check
```

---

## 🐳 Docker Validation

CI builds and tests Docker images. To replicate locally:

```bash
# Build backend Docker image
docker build -t kyarafit-backend:test -f backend/Dockerfile ./backend

# Build web Docker image
docker build -t kyarafit-web:test -f web/Dockerfile .

# Build image service Docker image
docker build -t kyarafit-image-service:test -f image-service/Dockerfile ./image-service

# Test run (example for backend)
docker run --rm kyarafit-backend:test --help
```

---

## 📊 What CI Runs on Pull Requests

When you open a PR, CI runs these workflows:

### Main CI (`ci.yml`)
- **Backend CI**: Go tests, linting (vet, gofmt, golangci-lint), Docker build
- **Web CI**: TypeScript check, ESLint, Next.js build, Docker build, Lighthouse (optional)
- **Mobile CI**: TypeScript check, ESLint, Prettier check, Expo web export
- **Image Service CI**: Python linting (black, isort, flake8, mypy), tests, Docker build
- **Integration Tests**: Smoke tests with backend + image service + postgres + redis
- **Security Scan**: Gitleaks (secrets), Trivy (vulnerabilities), npm audit

### PR Checks Matrix

| Check | Backend | Web | Mobile | Image Service |
|-------|---------|-----|--------|---------------|
| Linting | ✅ Go vet, golangci-lint | ✅ ESLint | ✅ ESLint | ✅ flake8, black, isort |
| Type Check | ✅ (built-in) | ✅ tsc | ✅ tsc | ✅ mypy |
| Formatting | ✅ gofmt | ✅ Prettier | ✅ Prettier | ✅ black, isort |
| Unit Tests | ✅ go test | ⚠️ (none yet) | ⚠️ (none yet) | ✅ pytest |
| Build | ✅ Binary + Docker | ✅ Next.js + Docker | ✅ Expo web | ✅ Docker |
| Security | ✅ gosec (optional) | ✅ npm audit | ✅ npm audit | ✅ safety, bandit |

---

## ⚡ Fast Feedback Loop

**Before committing:**

```bash
# Quick checks (< 1 min)
npm run format:check && npm run lint
```

**Before pushing:**

```bash
# Full validation (2-5 min)
make validate
```

**Fastest option (web only, most common):**

```bash
cd web
npm run typecheck && npm run lint && npm run build
```

---

## 🔧 Development Workflow

### Recommended Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes...

# 3. Format code
make format

# 4. Run quick checks
npm run lint && npm run typecheck

# 5. Commit
git add .
git commit -m "feat: add new feature"

# 6. Before pushing, run full validation
make validate

# 7. Push
git push origin feature/my-feature
```

---

## 🚨 Common CI Failures & Fixes

### "Prettier formatting check failed"

```bash
# Fix it:
npm run format

# Or just web/mobile:
cd web && npm run format
cd mobile && npm run format
```

### "TypeScript error: Cannot find module..."

```bash
# Reinstall dependencies
npm install

# Check if you're importing from the right place
# Design system exports:
#   - Use: import { ... } from '@kyarafit/design-system'
#   - Not: import { ... } from 'design-system'
```

### "Go: gofmt -s -l found issues"

```bash
cd backend
gofmt -s -w .
```

### "Next.js build failed"

```bash
cd web
npm run build

# Common issues:
# - Missing env vars (check .env.example)
# - Type errors (run npm run typecheck first)
# - Import errors (check paths)
```

### "golangci-lint not installed"

```bash
# Install it:
brew install golangci-lint  # macOS
# or
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

### "Backend tests fail: connection refused"

```bash
# Start Docker services first
make docker-up

# Then run tests
make test-backend
```

---

## 🎯 CI Optimization Tips

1. **Use path filtering**: CI only runs when relevant files change
   - Change `backend/` → only backend CI runs
   - Change `web/` or `design-system/` → only web CI runs
   - Change `mobile/` → only mobile CI runs

2. **Caching works**: 
   - npm dependencies are cached
   - Go modules are cached
   - Python packages are cached
   - Docker layers are cached

3. **Mobile native builds are optional**:
   - CI runs lint/typecheck only
   - Full EAS builds only on main/develop (if EXPO_TOKEN set)

---

## 📚 Additional Resources

- **GitHub Actions logs**: Check the Actions tab in GitHub for detailed logs
- **Deployment**: See `docs/GCP_DEPLOYMENT.md` for deployment info
- **Architecture**: See `docs/architecture.md` for system overview
- **Contributing**: See `docs/CONTRIBUTING.md` for contribution guidelines

---

## 🆘 Need Help?

If CI is failing and you can't reproduce locally:

1. Check the **full error message** in GitHub Actions logs
2. Compare your local tool versions with CI (Node 20, Go 1.21, Python 3.11)
3. Make sure you've pulled the latest changes: `git pull origin main`
4. Try a clean install: `rm -rf node_modules && npm install`

For backend:
```bash
cd backend && go clean -modcache && go mod download
```

For Python:
```bash
cd image-service && pip install --upgrade -r requirements.txt
```

---

**Remember:** If `make validate` passes locally, your PR will almost certainly pass CI! 🎉
