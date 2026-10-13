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
│   └── tsconfig.json    # Backend + shared libraries compiled to server/dist
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
npm run dev              # frontend on :3000 + Elysia backend on :4000
# Alternatively, run dev:web and dev:server in separate terminals.

```

`npm run dev` loads `.env` and `.env.local` for both services. It stops with a
clear message if port 3000 or 4000 is already occupied. Stop the old server
before restarting. Without `DATABASE_URL`, data uses the temporary development
store and does not survive backend restarts.

## Deployment (Docker)

A single-container image is provided. See [Deployment](#deployment-1) below for the full walkthrough, including how to bootstrap the first admin user and lock down the login page.


## Scripts

| Script                | Description                                |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Next.js frontend + Elysia backend          |
| `npm run dev:web`     | Next.js frontend only                     |
| `npm run dev:server`  | Elysia backend (watch mode)                |
| `npm run build`       | Build frontend                             |
| `npm run build:server`| Compile backend and shared libraries to `server/dist` |
| `npm run start`       | Start Next.js production server            |
| `npm run start:server`| Run `server/dist/server/index.js`          |
| `npm run db:generate` | Generate Prisma client                     |
| `npm run db:migrate`  | Run Prisma migrations                      |
| `npm run db:push`     | Push schema to DB (no migration history)   |
| `npm run db:studio`   | Open Prisma Studio                         |
| `npm run typecheck`   | TypeScript type check                      |
| `npm run lint`        | ESLint                                     |

## List pagination

Data lists start at 10 records per page and offer 10, 50, 100, or 200 records.
Pagination controls are hidden when the filtered total is 10 or fewer.
For larger totals, the size selector stays available even when all results fit
on one page; navigation arrows appear only when multiple pages exist.
Search/filter changes reset the page; deleting the final record on a page
returns to the last available page.

Persisted lists use server-side pagination. Finance queries count matching rows,
apply database `skip`/`take` or SQL `LIMIT`/`OFFSET`, and use a stable ID tie-breaker.
The response contains `items`, `page`, `pageSize`, `total`, `totalPages`, and an
optional `summary`. Page sizes must be positive integers up to 200; invalid
page numbers or sizes return HTTP 400.
The server clamps a page that no longer exists after deletion.

Search and filters run on the server. Global or period-wide balances, totals,
charts, and daily transaction subtotals come from server aggregates rather than
the visible records. The browser retains summary totals while another page loads,
aborts obsolete requests, and refreshes mounted lists after writes.
Transaction month filters use UTC boundaries, matching the ISO date keys in the
transaction list.
Calendar week buckets and admin signup charts use the server time zone for
consistent filtering and date labels.

Coverage includes finance lists, nested wallet pockets/category subcategories,
debt groups and installments, split-bill participants/reminders, business
transactions, admin users, invoice history, team members, bot permissions/contacts,
market candidates, and watchlists. Watchlist metadata
includes membership IDs; quote requests cover only visible symbols. Historical
screening uses the server cache and returns only the requested candidate page.

Admin reads include legacy records whose `userId` is `NULL`, as before pagination.
Owner/member reads remain restricted to their authenticated user ID. Restoring
legacy visibility does not reassign or rewrite financial records.

`/bootstrap` and `/lookups` contain wallet/category form options and account
settings, not transaction, debt, invoice, or other history arrays. `/export`
returns full records only for an explicit export. Imports fetch paged record IDs
for duplicate detection; resets delete bounded batches. Explicit portfolio-wide
price refresh reads all positions, while automatic refresh covers visible assets.

Wallet balance distribution shows every root wallet, ordered by combined balance
from largest to smallest, including nested pockets. It has no pagination.
Investment performance returns all eligible chart points in `summary.series`,
without raw investment records or pagination controls. Longer charts scroll
vertically and support keyboard scrolling; main wallet/investment lists remain
server-paginated.

Unsaved chat, OCR/import previews, static sessions/activity logs, finite badges,
and aggregate chart legends retain local pagination. They are not persisted
record lists.

Apply the pagination indexes to an existing PostgreSQL deployment:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/patches/20261013-server-pagination.sql
```

Run this patch outside a transaction because it uses `CREATE INDEX CONCURRENTLY`.
Fresh databases receive the same indexes through the Prisma schema.

Database regression coverage uses an isolated `fintrack_test` database on port
55432:

```bash
DATABASE_URL=postgresql://fintrack_test@127.0.0.1:55432/fintrack_test \
  npx tsx tests/server-pagination.integration.ts
```

Check the requested control visibility and size choices:

```bash
npx tsx tests/pagination-controls.regression.ts
```

## API Endpoints

All endpoints are mounted under `/api` on port 4000 (or whatever `PORT` is set to).

- `GET  /api/health` — Health check
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register
- `GET  /api/auth/me` — Current user (Bearer token)
- `GET  /api/bootstrap` and `/api/lookups`: Form lookups/account settings (auth required)
- `GET  /api/export`: Complete export bundle (auth required)
- `GET  /api/record-ids/:resource`: Paged IDs for import duplicate checks (auth required)
- `GET  /api/users` and `/api/admin/users`: Paged users and aggregate counts (admin only)
- `GET  /api/analytics/summary` and `/api/analytics/activity`: Server aggregates (auth required)
- `GET  /api/stock-screening`: Paged candidates, or `view=unavailable` (auth required)
- `GET  /api/market-watchlist`: Paged watchlist symbols (auth required)
- `GET  /api/market-search`: Paged market search (auth required)
- `GET  /api/subscriptions/invoices`: Paged invoice history (auth required)
- `GET  /api/subscriptions/invoices/:id`: Selected invoice/QR details (auth required)
- `GET  /api/debts?view=installments&debtId=...`: Paged installments (auth required)
- `POST /api/debts/:id/installments`: Add an installment (auth required)
- `PUT` or `DELETE /api/debts/:id/installments/:installmentId`: Edit/delete one installment (auth required)
- `GET  /api/splitBills?view=participants&billId=...`: Paged participants (auth required)
- `GET  /api/app-config` — App settings
- `PUT  /api/app-config` — Update app settings (admin only)
- `GET  /api/:resource`: Paged wallets/transactions/budgets/... (auth required)
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
docker compose --env-file .env.production up -d --build
docker compose logs -f app     # watch the first boot
```

To show Cloudflare Turnstile on login and register, set
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in
`.env.production` before building. Use the site key and secret from the same
Cloudflare widget, with your deployment domain allowed. The public site key
is embedded in the frontend during the build, so rebuild after changing it.
For local development, set the keys in `.env` and restart `npm run dev`.

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
