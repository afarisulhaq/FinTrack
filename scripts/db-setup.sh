#!/bin/sh
set -e
PATH="/app/node_modules/.bin:$PATH"
export PATH

if [ -z "$DATABASE_URL" ] || [ "$SKIP_PRISMA_PUSH" = "1" ]; then
  echo "[db-setup] skipping schema sync and seed (no DATABASE_URL or SKIP_PRISMA_PUSH=1)"
  exit 0
fi

echo "[db-setup] syncing database schema (prisma db push)..."
if prisma db push --skip-generate --accept-data-loss; then
  echo "[db-setup] schema sync ok"
else
  echo "[db-setup] WARN: schema sync failed; application will still start"
fi
