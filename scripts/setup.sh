#!/usr/bin/env bash
# TechSwiftTrix ERP — First-time setup script
# Usage: ./scripts/setup.sh [--env development|staging|production]
set -euo pipefail

ENV="${1:-development}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   TechSwiftTrix ERP — Setup ($ENV)                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────
echo "▶ Checking prerequisites..."
command -v node  >/dev/null 2>&1 || { echo "✗ Node.js 20+ required"; exit 1; }
command -v npm   >/dev/null 2>&1 || { echo "✗ npm 9+ required"; exit 1; }
command -v psql  >/dev/null 2>&1 || echo "  ⚠ psql not found — ensure PostgreSQL is running"
command -v redis-cli >/dev/null 2>&1 || echo "  ⚠ redis-cli not found — ensure Redis is running"

NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  echo "✗ Node.js 18+ required (found $NODE_VER)"; exit 1
fi
echo "  ✓ Node.js $(node --version)"

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "▶ Installing dependencies..."
npm install --prefix "$ROOT"
npm install --prefix "$ROOT/backend"
npm install --prefix "$ROOT/frontend"
echo "  ✓ Dependencies installed"

# ── 3. Copy env files ─────────────────────────────────────────────────────────
echo ""
echo "▶ Setting up environment files..."
if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "  ✓ Created backend/.env from .env.example"
  echo "  ⚠ Edit backend/.env and fill in DB_PASSWORD, JWT_SECRET, etc."
else
  echo "  ✓ backend/.env already exists"
fi

# ── 4. Create log directories ─────────────────────────────────────────────────
echo ""
echo "▶ Creating log directories..."
mkdir -p "$ROOT/backend/logs" "$ROOT/logs"
touch "$ROOT/backend/logs/.gitkeep"
echo "  ✓ Log directories ready"

# ── 5. Database setup ─────────────────────────────────────────────────────────
echo ""
echo "▶ Database setup..."
if command -v psql >/dev/null 2>&1; then
  DB_NAME="${DB_NAME:-techswifttrix_erp}"
  DB_USER="${DB_USER:-postgres}"
  echo "  Running: psql -U $DB_USER -c 'CREATE DATABASE $DB_NAME' (may fail if exists)"
  psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "  ⚠ Database may already exist — continuing"
  echo "  Running schema migrations..."
  psql -U "$DB_USER" -d "$DB_NAME" -f "$ROOT/backend/src/database/schema.sql" 2>/dev/null && echo "  ✓ Schema applied" || echo "  ⚠ Schema may already be applied"
  psql -U "$DB_USER" -d "$DB_NAME" -f "$ROOT/backend/src/database/seeds.sql" 2>/dev/null && echo "  ✓ Seeds applied" || echo "  ⚠ Seeds may already be applied"
else
  echo "  ⚠ psql not available — run schema manually:"
  echo "     psql -U postgres -d techswifttrix_erp -f backend/src/database/schema.sql"
  echo "     psql -U postgres -d techswifttrix_erp -f backend/src/database/seeds.sql"
fi

# ── 6. Build check ────────────────────────────────────────────────────────────
echo ""
echo "▶ TypeScript check..."
npx tsc --noEmit -p "$ROOT/backend/tsconfig.json" && echo "  ✓ Backend TypeScript OK" || echo "  ✗ Backend TypeScript errors"
npx tsc --noEmit -p "$ROOT/frontend/tsconfig.json" && echo "  ✓ Frontend TypeScript OK" || echo "  ✗ Frontend TypeScript errors"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Setup complete!                                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Start development:  ./start.sh"
echo "  Or individually:"
echo "    Backend:   npm run dev:backend"
echo "    Frontend:  npm run dev --workspace=frontend"
echo ""
echo "  Default credentials:"
echo "    CEO:   ceo@tst.com / Ceo@123456789!"
echo "    CFO:   cfo@tst.com / Cfo@123456789!"
echo "    Agent: agent@tst.com / Agent@1234567!"
echo ""
