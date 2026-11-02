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

# 2. i18n key parity
echo "========================================"
echo "🌐 i18n"
echo "========================================"

run_check "i18n key parity" npm run i18n:check

# 3. Linting
echo "========================================"
echo "🔍 Linting"
echo "========================================"

run_check "Web linting" npm run lint:web

run_check "Mobile linting" npm run lint:mobile

# 4. Type Checking
echo "========================================"
echo "🔎 Type Checking"
echo "========================================"

run_check "Web type checking" npm run typecheck:web

run_check "Mobile type checking" npm run typecheck:mobile

# 5. Building
echo "========================================"
echo "🏗️  Building"
echo "========================================"

run_check "Web build" npm run build:web

# 6. Testing
echo "========================================"
echo "🧪 Testing"
echo "========================================"

run_check "Web tests" npm run test -w web

run_check "Mobile tests" npm run test -w mobile

run_check "Convex tests" npm run test:convex

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
