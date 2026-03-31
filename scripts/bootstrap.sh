#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

copy_env() {
  local src="$1"
  local dst="$2"
  if [ -f "$dst" ]; then
    echo "  skip  $dst (already exists)"
  else
    cp "$src" "$dst"
    echo "  wrote $dst"
  fi
}

echo "==> Copying .env.example files..."

# Root — provides DATABASE_URL for packages/db (Prisma)
# copy_env ".env.example" ".env"

# Next.js app — uses .env.local (highest precedence, never committed)
copy_env "apps/web/.env.example" "apps/web/.env.local"

# Collaboration WebSocket server
copy_env "packages/collab-server/.env.example" "packages/collab-server/.env"

copy_env "packages/db/.env.example" "packages/db/.env"
echo ""
echo "==> Running dev-reset (Prisma generate + migrate + seed)..."
bash "$REPO_ROOT/scripts/dev-reset.sh"
