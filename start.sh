#!/usr/bin/env bash
# TechSwiftTrix ERP — Start all services (development)
# Usage: ./start.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"

# Use root node_modules binaries
VITE="$ROOT/node_modules/.bin/vite"
TSX="$ROOT/node_modules/.bin/tsx"

# ── Kill anything on our ports ────────────────────────────────────────────────
echo "Stopping any processes on ports 3000, 5173-5178..."
for port in 3000 5173 5174 5175 5176 5177 5178; do
  fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 1

# ── Start backend ─────────────────────────────────────────────────────────────
echo "Starting backend on :3000..."
(cd "$BACKEND" && NODE_ENV=development "$TSX" watch src/index.ts) > /tmp/tst-backend.log 2>&1 &
BACKEND_PID=$!

echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "✓ Backend ready."
    break
  fi
  sleep 1
done

# ── Start portals ─────────────────────────────────────────────────────────────
echo "Starting portals..."
(cd "$FRONTEND" && "$VITE" --config vite.config.ceo.ts)        > /tmp/tst-ceo.log       2>&1 &
(cd "$FRONTEND" && "$VITE" --config vite.config.executive.ts)  > /tmp/tst-executive.log 2>&1 &
(cd "$FRONTEND" && "$VITE" --config vite.config.clevel.ts)     > /tmp/tst-clevel.log    2>&1 &
(cd "$FRONTEND" && "$VITE" --config vite.config.operations.ts) > /tmp/tst-ops.log       2>&1 &
(cd "$FRONTEND" && "$VITE" --config vite.config.technology.ts) > /tmp/tst-tech.log      2>&1 &
(cd "$FRONTEND" && "$VITE" --config vite.config.agents.ts)     > /tmp/tst-agents.log    2>&1 &

sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   TechSwiftTrix ERP — All services running                  ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║   Backend API   →  http://localhost:3000                    ║"
echo "║   Health check  →  http://localhost:3000/health             ║"
echo "║   Portal Home   →  http://localhost:5173                    ║"
echo "║   CEO           →  http://localhost:5173/gatewayalpha       ║"
echo "║   Executive     →  http://localhost:5174/gatewaydelta       ║"
echo "║   C-Level       →  http://localhost:5175/gatewaysigma       ║"
echo "║   Operations    →  http://localhost:5176/gatewaynexus       ║"
echo "║   Technology    →  http://localhost:5177/gatewayvertex      ║"
echo "║   Agents        →  http://localhost:5178/gatewaypulse       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║   Logs: /tmp/tst-*.log                                      ║"
echo "║   Stop: Ctrl+C                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

trap "echo 'Stopping all services...'; kill 0" INT TERM
wait
