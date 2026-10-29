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

echo "[entrypoint] starting Elysia backend on :${PORT:-4000}..."
node server/dist/server/index.js &
BACKEND_PID=$!

# Give the backend a moment to bind the port before the frontend
# starts proxying /api/* to it.
sleep 1

echo "[entrypoint] starting Next.js frontend on :3000..."
# `output: "standalone"` produces server.js at the project root.
# Override PORT to 3000 because the Dockerfile sets PORT=4000 for the
# Elysia backend, and Next.js's server.js also reads PORT from the env —
# without this override it would try to bind to 4000 and fail with
# EADDRINUSE.
PORT=3000 node server.js &
FRONTEND_PID=$!

# Block until tini signals us (e.g. docker stop). When that happens,
# the trap above kills both children and we exit 0.
wait
