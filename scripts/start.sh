#!/usr/bin/env bash
# Kyarafit startup: docker-compose + optional local dev servers.
# Usage: ./scripts/start.sh [--no-docker] [--no-web] [--no-mobile]

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[start]${NC} $1"; }
ok()   { echo -e "${GREEN}[start]${NC} $1"; }
warn() { echo -e "${YELLOW}[start]${NC} $1"; }

# Parse flags
NO_DOCKER=false
NO_WEB=false
NO_MOBILE=false
for arg in "$@"; do
  case "$arg" in
    --no-docker) NO_DOCKER=true ;;
    --no-web)   NO_WEB=true ;;
    --no-mobile) NO_MOBILE=true ;;
  esac
done

# Env
if [ ! -f "$ROOT/.env" ]; then
  [ -f "$ROOT/.env.example" ] && cp "$ROOT/.env.example" "$ROOT/.env" && log "Created .env from .env.example"
fi

# Dependencies
if [ ! -d "$ROOT/node_modules" ]; then
  log "Installing npm dependencies..."
  npm install
  ok "npm install done"
fi

# Docker
if [ "$NO_DOCKER" = false ]; then
  log "Starting Docker (postgres, backend, image-service)..."
  docker compose up -d
  ok "Docker services up"
else
  warn "Skipping Docker (--no-docker)"
fi

# Backend (optional: if not using Docker backend, run locally)
# Uncomment to run backend locally instead of in Docker:
# log "Starting backend..."
# (cd "$ROOT/backend" && go run ./cmd/api) &
# sleep 2

# Web
if [ "$NO_WEB" = false ]; then
  log "Starting web (Next.js) in background..."
  (cd "$ROOT" && nohup npm run dev:web >> /tmp/kyarafit-web.log 2>&1 &)
  sleep 3
  ok "Web: http://localhost:3000 (log: /tmp/kyarafit-web.log)"
fi

# Mobile (--clear so Expo Router Babel plugin / require.context works)
if [ "$NO_MOBILE" = false ]; then
  log "Starting mobile (Expo) in background (cache clear for Expo Router)..."
  (cd "$ROOT" && nohup npm run start -w mobile -- --clear >> /tmp/kyarafit-mobile.log 2>&1 &)
  ok "Mobile: tail -f /tmp/kyarafit-mobile.log for QR / URL"
fi

echo ""
ok "Startup done."
echo "  Web:    http://localhost:3000"
echo "  Closet: http://localhost:3000/closet"
echo "  API:    http://localhost:8080/health"
echo "  Stop:   ./scripts/stop.sh or docker compose down"
echo ""
