#!/usr/bin/env bash
# Kyarafit startup script
# Usage: ./scripts/start.sh [--no-web] [--no-mobile] [--no-convex] [--single-terminal]
#   --single-terminal: run Convex/Web/Mobile in same terminal; type :q to stop all.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

log()  { echo -e "${BLUE}[start]${NC} $1"; }
ok()   { echo -e "${GREEN}[start]${NC} $1"; }
warn() { echo -e "${YELLOW}[start]${NC} $1"; }

kill_port() {
  local port="$1"
  local pids
  if command -v lsof &>/dev/null; then
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
  elif command -v fuser &>/dev/null; then
    pids=$(fuser "$port/tcp" 2>/dev/null | tr ' ' '\n' || true)
  fi
  if [ -n "$pids" ]; then
    for pid in $pids; do
      echo -e "  ${YELLOW}[port]${NC} Freeing port $port (PID $pid)"
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}

# Ports used by the stack (kill anything on these before starting)
NEEDED_PORTS="3000 8081 8082 19000 19001 19002"

# Parse flags
NO_WEB=false; NO_MOBILE=false; NO_CONVEX=false; SINGLE_TERMINAL=false
for arg in "$@"; do
  case "$arg" in
    --no-web)           NO_WEB=true ;;
    --no-mobile)        NO_MOBILE=true ;;
    --no-convex)        NO_CONVEX=true ;;
    --single-terminal)  SINGLE_TERMINAL=true ;;
  esac
done

# ── 1. Clean slate ────────────────────────────────────────────────────────────
log "Stopping existing services..."
"$ROOT/scripts/stop.sh" || true
sleep 1
log "Killing any remaining processes on needed ports..."
for port in $NEEDED_PORTS; do kill_port "$port"; done
sleep 1
ok "Clean slate."

# ── 2. Env ────────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  [ -f "$ROOT/.env.example" ] && cp "$ROOT/.env.example" "$ROOT/.env" && log "Created .env from .env.example"
fi

# ── 3. Dependencies ───────────────────────────────────────────────────────────
if [ ! -d "$ROOT/node_modules" ]; then
  log "Installing npm dependencies..."
  npm install
  ok "npm install done"
fi

# ── 4. Convex dev server ──────────────────────────────────────────────────────
if [ "$NO_CONVEX" = false ]; then
  log "Starting Convex dev server in background..."
  (cd "$ROOT" && nohup npx convex dev >> /tmp/kyarafit-convex.log 2>&1 &)
  sleep 2
  ok "Convex dev server starting (log: /tmp/kyarafit-convex.log)"
fi

# ── 5. Web (Next.js on :3000) ─────────────────────────────────────────────────
if [ "$NO_WEB" = false ]; then
  log "Freeing port 3000 before web..."
  kill_port 3000
  log "Starting web (Next.js) in background..."
  (cd "$ROOT" && nohup npm run dev:web >> /tmp/kyarafit-web.log 2>&1 &)
  sleep 2
  ok "Web: http://localhost:3000 (log: /tmp/kyarafit-web.log)"
fi

# ── 6. Mobile (Expo on :8081 / :19000) ───────────────────────────────────────
if [ "$NO_MOBILE" = false ]; then
  log "Freeing Expo ports (8081, 8082, 19000, 19001, 19002)..."
  for port in 8081 8082 19000 19001 19002; do kill_port "$port"; done
  log "Starting mobile (Expo) in background..."
  (cd "$ROOT" && nohup npm run start -w mobile -- --clear >> /tmp/kyarafit-mobile.log 2>&1 &)
  ok "Mobile: tail -f /tmp/kyarafit-mobile.log for QR / URL"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
ok "Startup done."
echo "  Web:          http://localhost:3000"
echo "  Closet:       http://localhost:3000/closet"
echo "  Conventions:  http://localhost:3000/conventions"
echo "  Stop:         ./scripts/stop.sh"
echo "  One terminal + :q to stop:  ./scripts/start.sh --single-terminal"
if [ "$SINGLE_TERMINAL" = true ]; then
  echo ""
  echo "  Type  :q  and Enter to stop all services and exit."
  echo ""
  while true; do
    read -r line
    if [ "$line" = ":q" ]; then
      log "Stopping all services..."
      "$ROOT/scripts/stop.sh" || true
      ok "Done. Exiting."
      exit 0
    fi
  done
fi
echo ""
echo "  NOTE: Convex handles the database. No Go backend needed."
echo ""
