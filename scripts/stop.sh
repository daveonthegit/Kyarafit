#!/usr/bin/env bash
# Stop Docker and dev servers (web on 3000, Expo on 19000).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[stop] Stopping Docker services..."
docker compose down

echo "[stop] Stopping dev servers (3000=web, 8081=Metro, 19000=Expo)..."
for port in 3000 8081 19000; do
  pid=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "[stop] Killing process on port $port (PID: $pid)"
    kill $pid 2>/dev/null || true
  fi
done

echo "[stop] Done."
