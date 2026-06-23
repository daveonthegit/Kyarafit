# Local CI Validation Script (PowerShell)
# Runs the same checks that GitHub Actions CI runs

$ErrorActionPreference = "Continue"
$OriginalLocation = Get-Location
$RootDir = Split-Path -Parent $PSScriptRoot

Set-Location $RootDir

Write-Host "========================================"
Write-Host "🚀 Running Local CI Checks" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

$Failed = 0

function Run-Check {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "▶ $Name" -ForegroundColor Blue

    try {
        & $Command
        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
            Write-Host "✅ $Name passed" -ForegroundColor Green
            Write-Host ""
            return $true
        } else {
            throw "Command failed with exit code $LASTEXITCODE"
        }
    } catch {
        Write-Host "❌ $Name failed" -ForegroundColor Red
        Write-Host ""
        $script:Failed++
        return $false
    }
}

# 1. Format Checking
Write-Host "========================================"
Write-Host "📝 Code Formatting"
Write-Host "========================================"

Run-Check "Prettier format check" {
    npm run format:check
}

# 2. i18n key parity
Write-Host "========================================"
Write-Host "🌐 i18n"
Write-Host "========================================"

Run-Check "i18n key parity" {
    npm run i18n:check
}

# 3. Linting
Write-Host "========================================"
Write-Host "🔍 Linting"
Write-Host "========================================"

Run-Check "Web linting" {
    npm run lint:web
}

Run-Check "Mobile linting" {
    npm run lint:mobile
}

# 4. Type Checking
Write-Host "========================================"
Write-Host "🔎 Type Checking"
Write-Host "========================================"

Run-Check "Web type checking" {
    npm run typecheck:web
}

Run-Check "Mobile type checking" {
    npm run typecheck:mobile
}

# 5. Building
Write-Host "========================================"
Write-Host "🏗️  Building"
Write-Host "========================================"

Run-Check "Web build" {
    npm run build:web
}

# 6. Testing
Write-Host "========================================"
Write-Host "🧪 Testing"
Write-Host "========================================"

Run-Check "Web tests" {
    npm run test -w web
}

Run-Check "Mobile tests" {
    npm run test -w mobile
}

Run-Check "Convex tests" {
    npm run test:convex
}

# Summary
Write-Host ""
Write-Host "========================================"
Write-Host "📊 Summary"
Write-Host "========================================"

Set-Location $OriginalLocation

if ($Failed -eq 0) {
    Write-Host "✅ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your code is ready to push. CI will pass! 🎉"
    exit 0
} else {
    Write-Host "❌ $Failed check(s) failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before pushing."
    Write-Host ""
    Write-Host "Quick fixes:"
    Write-Host "  - Format issues: make format"
    Write-Host "  - Type errors: npm run typecheck"
    Write-Host "  - Lint errors: Check individual linter output"
    exit 1
}
