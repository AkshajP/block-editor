#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Stopping and removing existing containers and volumes..."
docker compose down -v --remove-orphans

echo "==> Starting containers..."
docker compose up -d

# ── Wait for Postgres ─────────────────────────────────────────────────────────
echo "==> Waiting for Postgres to be ready..."
until docker exec block-editor-postgres pg_isready -U postgres -q; do
  sleep 1
done
echo "    Postgres is ready."

# ── Wait for Keycloak ─────────────────────────────────────────────────────────
echo "==> Waiting for Keycloak to be ready (this can take 30-60 seconds)..."
until curl -sf http://localhost:8080/realms/master > /dev/null 2>&1; do
  sleep 3
done
echo "    Keycloak is ready."

# ── Generate Prisma client ────────────────────────────────────────────────────
echo "==> Generating Prisma client..."
pnpm --filter @block-editor/db db:generate

# ── Run Prisma migrations ─────────────────────────────────────────────────────
echo "==> Running database migrations..."
pnpm --filter @block-editor/db db:migrate:dev

# ── Run seed ──────────────────────────────────────────────────────────────────
echo "==> Seeding database (permissions, system roles)..."
pnpm --filter @block-editor/db db:seed

echo ""
echo "==> Dev environment ready."
echo ""
echo "    Services:"
echo "      Frontend  : http://localhost:3000"
echo "      Keycloak  : http://localhost:8080  (admin / admin)"
echo "      PgAdmin   : http://localhost:5050  (admin@local.dev / admin)"
echo "      Postgres  : localhost:5432         (postgres / postgres)"
echo ""
echo "    Seed users (Keycloak realm: block-editor):"
echo "      admin@dev.local   / password  -> Admin role"
echo "      editor@dev.local  / password  -> Editor role"
echo "      viewer@dev.local  / password  -> Viewer role"
