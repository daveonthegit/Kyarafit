#!/bin/bash
set -e

# Local CI Validation Script
# Runs the same checks that GitHub Actions CI runs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "========================================"
echo "🚀 Running Local CI Checks"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0

run_check() {
    local name="$1"
    shift
    echo -e "${BLUE}▶ $name${NC}"
    if "$@"; then
        echo -e "${GREEN}✅ $name passed${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ $name failed${NC}"
        echo ""
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 1. Format Checking
echo "========================================"
echo "📝 Code Formatting"
echo "========================================"

run_check "Prettier format check" npm run format:check

# Go backend is archived — skip Go format check
echo -e "${YELLOW}⚠️  Go backend archived, skipping Go format check${NC}"

if command -v black &> /dev/null; then
    run_check "Python format check (black)" bash -c "cd image-service && black --check ."
else
    echo -e "${YELLOW}⚠️  black not installed, skipping Python format check${NC}"
fi

if command -v isort &> /dev/null; then
    run_check "Python import sorting (isort)" bash -c "cd image-service && isort --check-only ."
else
    echo -e "${YELLOW}⚠️  isort not installed, skipping Python import check${NC}"
fi

# 2. Linting
echo "========================================"
echo "🔍 Linting"
echo "========================================"

run_check "Web linting" npm run lint:web

run_check "Mobile linting" npm run lint:mobile

# Go backend is archived — skip Go lint checks
echo -e "${YELLOW}⚠️  Go backend archived, skipping Go vet and golangci-lint${NC}"

if command -v flake8 &> /dev/null; then
    run_check "Python linting (flake8)" bash -c "cd image-service && flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics"
else
    echo -e "${YELLOW}⚠️  flake8 not installed, skipping Python linting${NC}"
fi

# 3. Type Checking
echo "========================================"
echo "🔎 Type Checking"
echo "========================================"

run_check "Web type checking" npm run typecheck:web

run_check "Mobile type checking" npm run typecheck:mobile

# 4. Building
echo "========================================"
echo "🏗️  Building"
echo "========================================"

run_check "Web build" bash -c "npm run build:web 2>&1 | tee /tmp/web-build.log; if grep -q '✓ Generating static pages' /tmp/web-build.log; then exit 0; else exit 1; fi"

# Go backend is archived — skip backend build
echo -e "${YELLOW}⚠️  Go backend archived, skipping backend build${NC}"

if command -v python3 &> /dev/null; then
    run_check "Image service compile check" bash -c "cd image-service && python3 -m compileall ."
else
    echo -e "${YELLOW}⚠️  python3 not found, skipping image service compile check${NC}"
fi

# 5. Testing
echo "========================================"
echo "🧪 Testing"
echo "========================================"

# Go backend is archived — skip backend tests
echo -e "${YELLOW}⚠️  Go backend archived, skipping backend tests${NC}"

run_check "Web tests" npm run test -w web || echo -e "${YELLOW}⚠️  No web tests configured yet${NC}"

if command -v pytest &> /dev/null; then
    run_check "Image service tests" bash -c "cd image-service && pytest -v"
else
    echo -e "${YELLOW}⚠️  pytest not installed, skipping image service tests${NC}"
fi

# Summary
echo ""
echo "========================================"
echo "📊 Summary"
echo "========================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Your code is ready to push. CI will pass! 🎉"
    exit 0
else
    echo -e "${RED}❌ $FAILED check(s) failed${NC}"
    echo ""
    echo "Please fix the issues above before pushing."
    echo ""
    echo "Quick fixes:"
    echo "  - Format issues: make format"
    echo "  - Type errors: npm run typecheck"
    echo "  - Lint errors: Check individual linter output"
    exit 1
fi
