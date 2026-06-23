# Running CI Checks Locally

This guide shows you how to run the same checks that GitHub Actions CI runs, **before** you push your code. This helps catch issues early and ensures your PR will pass CI.

The stack is TypeScript-only: a Next.js **web** app, an Expo **mobile** app, a shared **design-system**, and a **Convex** backend.

## 🚀 Quick Start

Run all CI checks at once:

```bash
# Using Make (recommended)
make validate

# Using npm
npm run validate

# Using standalone script (Unix/Mac/WSL)
bash scripts/ci-local.sh
# or
npm run ci

# Using standalone script (Windows PowerShell)
powershell -ExecutionPolicy Bypass -File scripts/ci-local.ps1
# or
npm run ci:win
```

This runs: format checking → i18n key parity → linting → type checking → building → tests

---

## 📋 Prerequisites

### Required Tools

1. **Node.js 20+** and npm
2. **Make** (optional but recommended)

### Install Dependencies

```bash
make install
# or
npm install
```

---

## 🔍 Individual Check Commands

### 1. Code Formatting

```bash
make format-check   # Check (CI does this)
make format         # Auto-fix
```

Formatting is handled by Prettier across all JavaScript/TypeScript/JSON/Markdown files.

### 2. Linting

```bash
make lint           # Lint everything
make lint-web       # Next.js ESLint
make lint-mobile    # Expo ESLint
```

### 3. Type Checking

```bash
make typecheck      # Type check all TypeScript
npm run typecheck:web
npm run typecheck:mobile
```

### 4. Building

```bash
make build          # Build the web app
make build-web      # Next.js production build
```

The web build is the **most important** — it catches TypeScript errors, missing imports, and Next.js config issues.

### 5. Testing

```bash
make test           # Run all tests
make test-web       # Web tests (Vitest)
make test-mobile    # Mobile tests
make test-convex    # Convex backend tests (convex-test)
```

---

## 🔒 Security Checks

### Secret Scanning (Gitleaks)

```bash
# Install gitleaks (macOS: brew install gitleaks)
gitleaks detect --source . --verbose
```

### Dependency Audits

```bash
npm audit --audit-level=critical
```

---

## ⚡ Fast Feedback Loop

**Before committing:**

```bash
npm run format:check && npm run lint
```

**Before pushing:**

```bash
make validate
```

**Fastest option (web only, most common):**

```bash
cd web
npm run typecheck && npm run lint && npm run build
```

---

## 🚨 Common Failures & Fixes

### "Prettier formatting check failed"

```bash
npm run format
```

### "TypeScript error: Cannot find module..."

```bash
# Reinstall dependencies
npm install

# Check imports — design system exports:
#   - Use: import { ... } from '@kyarafit/design-system'
#   - Not: import { ... } from 'design-system'
```

### "i18n key parity failed"

```bash
# Locale files are out of sync. Add the missing keys to every locale
# (web/messages/*.json and mobile/src/i18n/locales/*.json), then:
npm run i18n:check
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

---

## 📚 Additional Resources

- **GitHub Actions logs**: Check the Actions tab in GitHub for detailed logs
- **Architecture**: See `docs/architecture.md` for system overview
- **Contributing**: See `docs/CONTRIBUTING.md` for contribution guidelines

---

**Remember:** If `make validate` passes locally, your PR will almost certainly pass CI! 🎉
