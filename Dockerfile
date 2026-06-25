# ─────────────────────────────────────────────────────────
# FinTrack — production image
#
# Single container, runs:
#   - Elysia backend (port 4000, internal only)
#   - Next.js frontend (port 3000, exposed)
#
# Next.js's rewrite proxies browser `/api/*` calls to the backend
# on loopback, so only port 3000 needs to be published.
#
# Postgres is intentionally NOT in this image — pass DATABASE_URL
# via the compose env_file.
# ─────────────────────────────────────────────────────────

# 1. Deps — install everything we need to build
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `--include=dev` so we get typescript, prisma, t3-env, etc. for the build stage
RUN npm ci --no-audit --no-fund
# Generate the Prisma client into node_modules so the build stage can pick it up
RUN npx prisma generate

# 2. Build — compile the Next.js frontend and the Elysia backend
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env for Cloudflare Turnstile (NEXT_PUBLIC_* must be present
# at build time — they are inlined into the client bundle).
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

RUN npm run build:server
RUN npm run build:web

# 3. Runtime — slim image with only the artifacts we need to run
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=4000

# Next.js standalone output (server.js + .next chunks)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Elysia backend (compiled by tsc to server/dist)
COPY --from=build /app/server/dist ./server/dist

# Backend runtime deps (Prisma, bcryptjs, Elysia, etc.). The Next.js
# bundle has its own node_modules inside .next/standalone, so this copy
# is only for the backend — they don't conflict.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Entrypoint script that runs both processes
COPY --from=build /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# WhatsApp bot session (Baileys) lives outside the image so re-builds
# don't wipe the pairing creds. Mount a volume here in compose.
RUN mkdir -p /app/.baileys-session
# Disk-backed Yahoo Finance cache (see server/services/market-price.ts).
# Compose mounts a named volume on top of this so the JSON file
# survives `docker compose up --build`.
RUN mkdir -p /app/data

EXPOSE 3000

# tini reaps zombies and forwards signals so the child Node processes
# shut down cleanly when `docker stop` is run.
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "server.js"]
