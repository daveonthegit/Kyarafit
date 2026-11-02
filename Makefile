.PHONY: help install dev dev-web dev-mobile
.PHONY: lint lint-web lint-mobile
.PHONY: typecheck typecheck-web typecheck-mobile
.PHONY: format format-check
.PHONY: test test-web test-mobile test-convex
.PHONY: build build-web
.PHONY: validate ci-local ci-script clean

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================================
# Installation & Setup
# ============================================================================

install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Dependencies installed"

# ============================================================================
# Development
# ============================================================================

dev: dev-web ## Start the web app in development mode

dev-web: ## Run web app in development mode
	@echo "🌐 Starting web app..."
	npm run dev:web

dev-mobile: ## Run mobile app in development mode
	@echo "📱 Starting mobile app..."
	npm run dev:mobile

# ============================================================================
# Linting
# ============================================================================

lint: lint-web lint-mobile ## Run all linters

lint-web: ## Lint web application
	@echo "🔍 Linting web..."
	npm run lint:web

lint-mobile: ## Lint mobile application
	@echo "🔍 Linting mobile..."
	npm run lint:mobile

# ============================================================================
# Type Checking
# ============================================================================

typecheck: typecheck-web typecheck-mobile ## Run all type checks

typecheck-web: ## Type check web application
	@echo "🔎 Type checking web..."
	npm run typecheck:web

typecheck-mobile: ## Type check mobile application
	@echo "🔎 Type checking mobile..."
	npm run typecheck:mobile

# ============================================================================
# Formatting
# ============================================================================

format: ## Format all code (auto-fix)
	@echo "✨ Formatting code..."
	npm run format
	@echo "✅ Code formatted"

format-check: ## Check code formatting (no auto-fix)
	@echo "🔍 Checking code formatting..."
	npm run format:check

# ============================================================================
# Testing
# ============================================================================

test: test-web test-mobile test-convex ## Run all tests

test-web: ## Run web tests
	@echo "🧪 Running web tests..."
	npm run test -w web

test-mobile: ## Run mobile tests
	@echo "🧪 Running mobile tests..."
	npm run test -w mobile

test-convex: ## Run Convex backend tests
	@echo "🧪 Running Convex tests..."
	npm run test:convex

# ============================================================================
# Building
# ============================================================================

build: build-web ## Build all deployable apps

build-web: ## Build web application
	@echo "🏗️  Building web..."
	npm run build:web

# ============================================================================
# CI/CD Local Validation
# ============================================================================

validate: format-check lint typecheck build test ## Run all CI checks locally (full validation)
	@echo ""
	@echo "✅ All validation checks passed!"
	@echo ""
	@echo "Ready to push to GitHub. Your code will pass CI checks."

ci-local: validate ## Alias for 'validate' - run all CI checks locally

ci-script: ## Run CI checks using standalone script
	@echo "Running CI validation script..."
	@bash scripts/ci-local.sh

# ============================================================================
# Utilities
# ============================================================================

clean: ## Clean build artifacts and caches
	@echo "🧹 Cleaning..."
	rm -rf web/.next
	rm -rf mobile/dist-web
	find . -name ".DS_Store" -delete
	@echo "✅ Cleaned"
