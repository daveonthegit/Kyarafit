#!/usr/bin/env bash
# Stop Docker services and any dev-server processes on known ports.
# Ports:
#   3000  - Next.js web
#   8000  - Image service (Docker / FastAPI)
#   8081  - Expo Metro bundler
#   8082  - Expo Metro (fallback)
#   19000 - Expo Go
#   19001 - Expo DevTools
#   19002 - Expo web DevTools

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
GRAY='\033[0;90m'
NC='\033[0m'

kill_port() {
  local port="$1"
  local pids
  # lsof covers macOS + Linux; fuser is a common fallback on Linux
  if command -v lsof &>/dev/null; then
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
  elif command -v fuser &>/dev/null; then
    pids=$(fuser "$port/tcp" 2>/dev/null | tr ' ' '\n' || true)
  fi

  if [ -n "$pids" ]; then
    for pid in $pids; do
      echo -e "${YELLOW}[stop]${NC} Killing PID $pid on port $port"
      kill -9 "$pid" 2>/dev/null || true
    done
  else
    echo -e "${GRAY}[stop]${NC} Port $port is free"
  fi
}

echo -e "${GRAY}[stop]${NC} Stopping Docker services..."
docker compose down 2>/dev/null || true

echo -e "${GRAY}[stop]${NC} Freeing ports..."
kill_port 3000   # Next.js web
kill_port 8000   # Image service
kill_port 8081   # Expo Metro
kill_port 8082   # Expo Metro fallback
kill_port 19000  # Expo Go
kill_port 19001  # Expo DevTools
kill_port 19002  # Expo web DevTools

echo -e "${GREEN}[stop]${NC} Done."
