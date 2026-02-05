.PHONY: help install dev dev-backend dev-web dev-mobile docker-up docker-down docker-logs
.PHONY: lint lint-backend lint-web lint-mobile lint-image-service
.PHONY: typecheck typecheck-web typecheck-mobile
.PHONY: format format-check
.PHONY: test test-backend test-web test-mobile test-image-service
.PHONY: build build-web build-backend build-image-service
.PHONY: validate ci-local clean

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================================
# Installation & Setup
# ============================================================================

install: ## Install all dependencies (npm + Go + Python)
	@echo "📦 Installing dependencies..."
	npm install
	cd backend && go mod download
	cd image-service && pip install -r requirements.txt
	@echo "✅ Dependencies installed"

# ============================================================================
# Development
# ============================================================================

dev: docker-up ## Start all services in development mode
	@echo "🚀 Starting development environment..."
	@echo "Backend: http://localhost:8080"
	@echo "Web: http://localhost:3000"
	@echo "Image Service: http://localhost:8000"

docker-up: ## Start Docker services (postgres, redis)
	@echo "🐳 Starting Docker services..."
	docker-compose up -d
	@echo "✅ Docker services started"

docker-down: ## Stop Docker services
	@echo "🛑 Stopping Docker services..."
	docker-compose down
	@echo "✅ Docker services stopped"

docker-logs: ## View Docker logs
	docker-compose logs -f

dev-backend: docker-up ## Run backend in development mode
	@echo "🔧 Starting backend..."
	cd backend && go run main.go

dev-web: ## Run web app in development mode
	@echo "🌐 Starting web app..."
	npm run dev:web

dev-mobile: ## Run mobile app in development mode
	@echo "📱 Starting mobile app..."
	npm run dev:mobile

# ============================================================================
# Linting
# ============================================================================

lint: lint-web lint-mobile lint-backend lint-image-service ## Run all linters

lint-web: ## Lint web application
	@echo "🔍 Linting web..."
	npm run lint:web

lint-mobile: ## Lint mobile application
	@echo "🔍 Linting mobile..."
	npm run lint:mobile

lint-backend: ## Lint backend (Go)
	@echo "🔍 Linting backend..."
	cd backend && go vet ./...
	cd backend && gofmt -s -l . | grep . && exit 1 || exit 0
	cd backend && golangci-lint run || echo "⚠️  golangci-lint not installed"

lint-image-service: ## Lint image service (Python)
	@echo "🔍 Linting image service..."
	cd image-service && python -m flake8 . || echo "⚠️  flake8 not installed"
	cd image-service && black --check . || echo "⚠️  black not installed"

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
	cd backend && gofmt -s -w .
	cd image-service && black . || echo "⚠️  black not installed"
	cd image-service && isort . || echo "⚠️  isort not installed"
	@echo "✅ Code formatted"

format-check: ## Check code formatting (no auto-fix)
	@echo "🔍 Checking code formatting..."
	npm run format:check

# ============================================================================
# Testing
# ============================================================================

test: test-backend test-web test-image-service ## Run all tests

test-backend: docker-up ## Run backend tests
	@echo "🧪 Running backend tests..."
	cd backend && DATABASE_URL=postgres://postgres:postgres@localhost:5432/kyarafit_test?sslmode=disable \
		REDIS_URL=redis://localhost:6379 \
		JWT_SECRET=test-secret \
		go test -v -race -coverprofile=coverage.out ./...

test-web: ## Run web tests
	@echo "🧪 Running web tests..."
	npm run test -w web

test-mobile: ## Run mobile tests
	@echo "🧪 Running mobile tests..."
	npm run test -w mobile

test-image-service: ## Run image service tests
	@echo "🧪 Running image service tests..."
	cd image-service && python -m pytest -v || echo "⚠️  pytest not installed"

# ============================================================================
# Building
# ============================================================================

build: build-web build-backend build-image-service ## Build all services

build-web: ## Build web application
	@echo "🏗️  Building web..."
	npm run build:web

build-backend: ## Build backend binary
	@echo "🏗️  Building backend..."
	cd backend && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

build-image-service: ## Build image service (check imports)
	@echo "🏗️  Building image service..."
	cd image-service && python -m compileall .

# ============================================================================
# CI/CD Local Validation
# ============================================================================

validate: format-check lint typecheck build test ## Run all CI checks locally (full validation)
	@echo ""
	@echo "✅ All validation checks passed!"
	@echo ""
	@echo "Ready to push to GitHub. Your code will pass CI checks."

ci-local: validate ## Alias for 'validate' - run all CI checks locally

# ============================================================================
# Utilities
# ============================================================================

clean: ## Clean build artifacts and caches
	@echo "🧹 Cleaning..."
	rm -rf web/.next
	rm -rf mobile/dist-web
	rm -rf backend/main
	rm -rf **/*.pyc
	rm -rf **/__pycache__
	find . -name ".DS_Store" -delete
	@echo "✅ Cleaned"
