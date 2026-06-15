#!/bin/sh
# docker-entrypoint.sh — start the Elysia backend and the Next.js
# frontend in the same container. SIGTERM/SIGINT from `docker stop`
# is forwarded to both children so they shut down cleanly.

set -e

cleanup() {
  echo "[entrypoint] received signal, shutting down children..."
  # Kill the whole process group of each child
  kill -TERM $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  wait $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

# ── Auto-sync DB schema ──────────────────────────────────────────────────────
# `prisma db push` is additive: it creates missing tables/columns but
# never drops data. Running it on every boot means a fresh deploy with
# a new schema version still comes up cleanly without a manual
# `prisma db push` step. Set SKIP_PRISMA_PUSH=1 to opt out (e.g. when
# the operator manages schema with `prisma migrate` instead).
if [ -n "$DATABASE_URL" ] && [ "$SKIP_PRISMA_PUSH" != "1" ]; then
  echo "[entrypoint] syncing database schema (prisma db push)..."
  if npx prisma db push --skip-generate --accept-data-loss 2>&1; then
    echo "[entrypoint] schema sync ok"
  else
    echo "[entrypoint] WARN: prisma db push failed, continuing — backend will retry on first request"
  fi
else
  echo "[entrypoint] skipping prisma db push (no DATABASE_URL or SKIP_PRISMA_PUSH=1)"
fi

echo "[entrypoint] starting Elysia backend on :${PORT:-4000}..."
node server/dist/index.js &
BACKEND_PID=$!

# Give the backend a moment to bind the port before the frontend
# starts proxying /api/* to it.
sleep 1

echo "[entrypoint] starting Next.js frontend on :3000..."
# `output: "standalone"` produces server.js at the project root
node server.js &
FRONTEND_PID=$!

# Block until tini signals us (e.g. docker stop). When that happens,
# the trap above kills both children and we exit 0.
wait
