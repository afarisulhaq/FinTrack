# FinTrack

All-in-one personal & multi-user wealth and expense management platform. Built as a single root project combining a T3-App (Next.js) frontend with an Elysia backend.

## Stack

- **Frontend** — Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Radix UI + Zustand
- **Backend** — ElysiaJS on Bun/Node + Prisma (PostgreSQL) + JWT auth + Baileys (WhatsApp) + Telegram Bot API
- **Tooling** — TypeScript, ESLint, Prettier, Prisma

## Project Structure

```
.
├── prisma/              # Prisma schema & seed script (shared DB layer)
├── public/              # Static assets (favicon, etc.)
├── server/              # Elysia backend (API, bot, auth, services)
│   ├── index.ts         # Elysia server entry point
│   ├── auth.ts          # JWT sign/verify helpers
│   ├── auth-middleware.ts # Elysia auth plugins (requireAuth, requireAdmin)
│   ├── prisma-client.ts # Shared Prisma client (server side)
│   ├── data.ts          # In-memory fallback data
│   ├── routes/          # /api/auth, /api/finance, /api/bot
│   ├── services/        # AI parser, Telegram, WhatsApp
│   ├── types.ts         # Shared types
│   ├── utils.ts         # ok/fail/id helpers
│   └── tsconfig.json    # Server-only TS config (outputs to server/dist)
├── src/                 # Next.js frontend (T3-App layout)
│   ├── app/             # Routes — (auth), (dashboard), admin
│   ├── components/      # UI, charts, layout, auth
│   ├── lib/             # api client, types, mock data, utils
│   ├── store/           # Zustand stores (auth, finance, sidebar, config)
│   ├── server/          # Server-side Prisma client (Next.js API routes)
│   ├── styles/          # globals.css (Tailwind)
│   └── env.js           # T3 env validation
├── package.json         # Unified scripts for web + server
├── tsconfig.json        # Frontend TS config
└── next.config.mjs      # Next.js config (LAN origin, server external packages)
```

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Set environment (optional — defaults work in dev)
cp .env.example .env
# In `.env`, flip NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true to see the
# quick-login buttons on /login. Leave it off (or unset) in
# .env.production.

# 3. Run frontend + backend together
npm run dev              # frontend on :3000
npm run dev:server       # Elysia backend on :4000

# Or run both side by side via two terminals.
```

## Deployment (Docker)

A single-container image is provided. See [Deployment](#deployment-1) below for the full walkthrough, including how to bootstrap the first admin user and lock down the login page.


## Scripts

| Script                | Description                                |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Next.js dev server (frontend)              |
| `npm run dev:server`  | Elysia backend (watch mode)                |
| `npm run build`       | Build frontend                             |
| `npm run build:server`| Compile Elysia to `server/dist`            |
| `npm run start`       | Start Next.js production server            |
| `npm run start:server`| Run compiled Elysia server                 |
| `npm run db:generate` | Generate Prisma client                     |
| `npm run db:migrate`  | Run Prisma migrations                      |
| `npm run db:push`     | Push schema to DB (no migration history)   |
| `npm run db:studio`   | Open Prisma Studio                         |
| `npm run typecheck`   | TypeScript type check                      |
| `npm run lint`        | ESLint                                     |

## API Endpoints

All endpoints are mounted under `/api` on port 4000 (or whatever `PORT` is set to).

- `GET  /api/health` — Health check
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register
- `GET  /api/auth/me` — Current user (Bearer token)
- `GET  /api/bootstrap` — Full data bundle (auth required)
- `GET  /api/users` — List users (auth required)
- `GET  /api/app-config` — App settings
- `PUT  /api/app-config` — Update app settings (admin only)
- `GET  /api/:resource` — List wallets/transactions/budgets/... (auth required)
- `POST /api/:resource` — Create item (auth required)
- `PUT  /api/:resource/:id` — Update item (auth required)
- `DELETE /api/:resource/:id` — Delete item (auth required)
- `POST /api/bot/telegram/webhook` — Telegram webhook (public)
- `GET  /api/bot/status` — Bot connection status (auth)
- `POST /api/bot/whatsapp/start` — Start WhatsApp bot (auth)
- `POST /api/bot/whatsapp/stop` — Stop WhatsApp bot (auth)
- `POST /api/bot/telegram/test` — Send test Telegram message (auth)
- `POST /api/bot/whatsapp/test` — Send test WhatsApp message (auth)
- `POST /api/bot/ai/parse` — Parse finance text (auth)
- `POST /api/bot/ai/ocr` — Mock OCR receipt (auth)

## Default credentials (in-memory fallback)

- `admin@fintrack.app` / `admin123`
- `demo@fintrack.app` / `demo123`

When `DATABASE_URL` is set, the seed script (`prisma/seed.ts`) inserts the same users **only in development**. In production the defaults are skipped — see [Deployment](#deployment-1) for the env-var-driven admin bootstrap.

---

## Deployment

This project ships with a single-container Docker setup that bundles the Next.js frontend and the Elysia backend, fronted by a Next.js rewrite so only port 3000 is published.

### 1. Prepare the production env

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set **at minimum**:

```env
# External PostgreSQL (managed, RDS, Supabase, your own VPS, etc.)
DATABASE_URL=postgresql://fintrack:STRONG_PASSWORD@db.example.com:5432/fintrack?sslmode=require

# A long random string used to sign JWTs.
# Generate one with:  openssl rand -hex 64
JWT_SECRET=replace-me-with-64-bytes-of-random-hex

NODE_ENV=production
```

### 2. Bootstrap the first admin

In production the seed **does not** create the `admin@fintrack.app / admin123` default. You have two options:

**Option A — seed an admin from env vars (recommended for fresh deploys):**

Add these to `.env.production`:

```env
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=another-strong-password
ADMIN_NAME=Your Name
```

Then run the seed (the first container boot will pick this up if you mount the seed into entrypoint, or you can run it once manually — see step 3).

**Option B — register through the UI, then promote with Prisma Studio:**

1. Open `https://yourdomain.com/register` and create your account.
2. From your dev machine, run `npx prisma studio` against the production `DATABASE_URL`, open the `User` table, and change your row's `role` from `owner` to `admin`.
3. Log out, log back in — you'll land on `/admin` instead of `/dashboard`.

### 3. Build & run

```bash
docker compose up -d --build
docker compose logs -f app     # watch the first boot
```

The image is multi-stage: it builds the Next.js frontend (standalone output) and the Elysia backend (`tsc → server/dist`) in one go. Only port 3000 is published; `/api/*` calls are proxied internally to the Elysia backend on port 4000.

### 4. Put a reverse proxy in front (optional but recommended)

For TLS and a real domain, run Caddy / Nginx in front of port 3000. Minimal Caddy config:

```caddyfile
yourdomain.com {
  reverse_proxy localhost:3000
}
```

### 5. White-label the app

After the first admin logs in, open **Admin Panel → Pengaturan App** to change:

- **Nama Aplikasi** — the brand name shown in the sidebar, login page, auth layout, and any other place that uses the app name. Default: `FinTrack`.
- **Tagline** — the headline on the login page.
- **Logo & Icon** — swap the gradient icon for one of the built-ins or upload your own image.
- **Warna** — primary / accent / footer text.

These changes are persisted to the `AppSetting` table in the database, so they survive container rebuilds and propagate to all clients on the next `lastSyncedAt` poll.

### 6. Disable the demo login in production

The login page has a `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` toggle. In `.env` (dev) you can set it to `true` to show the quick-login buttons:

```env
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

In `.env.production` either leave it unset or set it to `false` — the demo buttons are hidden and the only way in is the normal email/password form (or a future SSO integration).

### 7. Persist the WhatsApp session

If you connect the WhatsApp bot, the Baileys pairing session is stored at `/app/.baileys-session` and mounted as a named Docker volume (`whatsapp-session`) so re-building the image does not force you to re-scan the QR code.

```bash
# Watch the first-time QR code appear:
docker compose logs -f app | grep -A 20 "QR"
```
