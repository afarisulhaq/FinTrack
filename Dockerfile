# syntax=docker/dockerfile:1
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
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `--include=dev` so we get typescript, prisma, t3-env, etc. for the build stage
RUN npm ci --no-audit --no-fund
# Generate the Prisma client into node_modules so the build stage can pick it up
RUN npx prisma generate

FROM node:22-alpine AS runtime-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts/runtime-package.mjs ./scripts/runtime-package.mjs
RUN node scripts/runtime-package.mjs db && \
    npm install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund && \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:22-alpine AS app-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts/runtime-package.mjs ./scripts/runtime-package.mjs
RUN node scripts/runtime-package.mjs app && \
    npm install --package-lock-only --omit=dev --ignore-scripts --no-audit --no-fund && \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund && \
    ./node_modules/.bin/prisma generate && \
    rm -rf node_modules/prisma node_modules/tsx node_modules/typescript \
      node_modules/@prisma/config node_modules/@prisma/engines \
      node_modules/@prisma/engines-version && \
    find node_modules/tesseract.js-core -maxdepth 1 -type f \
      ! -name '*-lstm*' ! -name 'index.js' ! -name 'package.json' -delete
FROM runtime-deps AS db-setup
COPY prisma ./prisma
COPY scripts/db-setup.sh /usr/local/bin/db-setup.sh
RUN chmod +x /usr/local/bin/db-setup.sh
ENTRYPOINT ["/usr/local/bin/db-setup.sh"]

# 2. Build — compile the Next.js frontend and the Elysia backend
FROM node:22-alpine AS build
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
RUN node scripts/build-seed.mjs /app/seed-dist
RUN npm run build:web

# 3. Runtime — slim image with only the artifacts we need to run
FROM node:22-alpine AS runtime
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
COPY --from=build /app/seed-dist/prisma/seed.js ./prisma/seed.js
COPY --from=build /app/seed-dist/server/services/default-categories.js ./server/services/default-categories.js
COPY --from=build /app/seed-dist/src/lib/default-categories.js ./src/lib/default-categories.js

COPY --from=app-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Entrypoint script that runs both processes
COPY --from=build /app/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# WhatsApp session and Yahoo Finance cache persist across image rebuilds.
RUN mkdir -p /app/.baileys-session /app/data

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "server.js"]
