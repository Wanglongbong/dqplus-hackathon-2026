#!/usr/bin/env bash
# Starts postgres, three backend services, and the web app.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

SERVICES=(
  "backend/gateway:gateway"
  "backend/agent/extract:extract"
  "backend/matching-engine:matching-engine"
  "frontend:web"
)

PIDS=()

cleanup() {
  status=$?
  trap - INT TERM EXIT
  echo ""
  echo "Stopping services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  exit "$status"
}
trap cleanup INT TERM EXIT

# 1. Ensure env files exist (copy from .env.example on first run; never overwrite)
if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Created root .env from .env.example."
fi

for entry in "${SERVICES[@]}"; do
  dir="${entry%%:*}"
  svc_path="$ROOT_DIR/$dir"
  if [ ! -f "$svc_path/.env" ] && [ -f "$svc_path/.env.example" ]; then
    cp "$svc_path/.env.example" "$svc_path/.env"
    echo "Created $dir/.env from .env.example."
  fi
done

# 2. Start postgres (pgvector) via docker compose
echo "Starting postgres (pgvector) via docker compose..."
if (cd "$ROOT_DIR" && docker compose up -d postgres); then
  echo "Waiting for postgres to become healthy..."
  db_ready=false
  for i in $(seq 1 30); do
    status="$(docker inspect --format='{{.State.Health.Status}}' dqplus-postgres 2>/dev/null || echo unknown)"
    if [ "$status" = "healthy" ]; then
      echo "postgres is healthy."
      db_ready=true
      break
    fi
    sleep 1
  done
  if [ "$db_ready" != "true" ]; then
    echo "Postgres did not become healthy in time."
    exit 1
  fi
else
  echo "Could not start postgres. Start Docker and try again."
  exit 1
fi

# 3. Start each node service (installing deps on first run)
for entry in "${SERVICES[@]}"; do
  dir="${entry%%:*}"
  name="${entry##*:}"
  svc_path="$ROOT_DIR/$dir"

  if [ ! -d "$svc_path/node_modules" ]; then
    echo "Installing dependencies for $name..."
    (cd "$svc_path" && npm ci)
  fi

  echo "Starting $name -> logs/$name.log"
  (cd "$svc_path" && npm run dev) > "$LOG_DIR/$name.log" 2>&1 &
  PIDS+=("$!")
done

sleep 2
for pid in "${PIDS[@]}"; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "A service failed during startup. Check the files in logs/."
    exit 1
  fi
done

echo ""
echo "gateway:         http://localhost:3000"
echo "extract agent:   http://localhost:3001"
echo "matching engine: http://localhost:3002"
echo "web app:         http://localhost:5173"
echo ""
echo "Tailing logs (Ctrl+C to stop all services)..."
tail -n +1 -f "$LOG_DIR"/*.log &
PIDS+=("$!")

wait
