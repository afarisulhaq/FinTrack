# FinTrack — Task Tracker

> Selalu diperbarui setiap kali ada progress pengerjaan.  
> Status: 🔲 Belum | 🔄 Sedang Dikerjakan | ✅ Selesai | ⏸ Ditunda

---

## Phase 1: Project Setup & Foundation (Frontend)

### 1.1 Inisialisasi Proyek
- ✅ Buat `task.md` sebagai file tracker
- ✅ Setup project Next.js 16 (App Router) + TypeScript
- ✅ Konfigurasi Tailwind CSS v4
- ✅ Install dependencies: recharts, lucide-react, zustand, react-hook-form, zod, framer-motion, radix-ui, clsx, cva
- ✅ Setup struktur folder frontend

### 1.2 Design System & Base Components
- ✅ Konfigurasi tema warna (dark/light mode support)
- ✅ Setup font & typography
- ✅ Buat komponen base: Button, Input, Card, Badge, Modal
- ✅ Buat Layout komponen: Sidebar, Topbar, PageWrapper
- ✅ Buat komponen Icon wrapper

---

## Phase 2: Halaman Utama (Core Pages)

### 2.1 Dashboard Utama
- ✅ Net Worth summary card
- ✅ Income vs Expense bar chart (bulan berjalan)
- ✅ Wallet balance overview (multi-pocket)
- ✅ Quick action shortcuts (tambah transaksi, scan struk, bayar tagihan)
- ✅ Recent transactions list
- ✅ Financial Monthly Heatmap (kalender gradasi pengeluaran)

### 2.2 Halaman Dompet (Wallets)
- ✅ Daftar Parent Wallet + Child Wallet (nested/hierarchical)
- ✅ Card per wallet dengan saldo & progress bar
- ✅ Modal tambah/edit wallet
- ✅ Distribusi saldo antar kantong (donut/pie chart)

### 2.3 Halaman Transaksi
- ✅ List transaksi dengan filter (tanggal, kategori, dompet)
- ✅ Modal tambah transaksi (income/expense/transfer)
- ✅ Kategori transaksi dengan icon
- ✅ Search & sort transaksi

### 2.4 Halaman Anggaran (Budget)
- ✅ Daftar budget per kategori
- ✅ Progress bar per kategori (alert 80%)
- ✅ Modal tambah/edit budget
- ✅ Summary total budget vs aktual

### 2.5 Halaman Investasi
- ✅ Multi-broker portfolio list
- ✅ Floating P/L per aset
- ✅ Pie chart alokasi kelas aset
- ✅ Table saham/crypto/emas dengan harga real-time (mock)

### 2.6 Halaman Tagihan (Bills)
- ✅ List tagihan dengan status (Belum Dibayar / Lunas)
- ✅ Tanggal jatuh tempo & alert
- ✅ Modal tambah tagihan

### 2.7 Halaman Tabungan (Savings Goals)
- ✅ List saving goals dengan progress
- ✅ Target dana & tenggat waktu
- ✅ Modal tambah saving goal

### 2.8 Halaman Utang & Piutang
- ✅ Tab Utang / Piutang
- ✅ Detail peminjam, jatuh tempo, riwayat cicilan
- ✅ Modal tambah utang/piutang

### 2.9 Halaman Statistik
- ✅ Breakdown pengeluaran per kategori (pie + bar chart)
- ✅ Trend pengeluaran bulanan (line chart)
- ✅ Rasio keuangan (debt-to-income, savings rate)
- ✅ Heatmap kalender pengeluaran (full page)

### 2.10 Halaman Kartu (Card Tracker)
- ✅ List kartu kredit/debit
- ✅ Limit, billing cycle, tanggal cetak struk
- ✅ Kalkulasi bunga cicilan

### 2.11 Halaman Wishlist
- ✅ List keinginan
- ✅ Kalkulator: berapa hari menabung untuk membelinya
- ✅ Prioritas / kategori wishlist

### 2.12 Halaman Reimbursement
- ✅ List reimbursement (Aktif / Lunas)
- ✅ Detail project/kantor
- ✅ Modal tambah reimbursement

### 2.13 Halaman Catatan (Notes)
- ✅ List catatan kasual
- ✅ Modal tambah/edit catatan

---

## Phase 3: Fitur Tambahan & Value-Added

### 3.1 Gamifikasi
- ✅ Financial Health Score (skor 1–100) — SVG ring, 4 pillar breakdown
- ✅ Badge & achievement system — 10 badges, unlocked/progress states, shimmer effect
- ✅ Streak counter (Zero-Spend Day) — 7-day grid, longest streak record
- ✅ XP & Level system (L1–L10) — animated XP bar (Framer Motion)
- ✅ Leaderboard mock preview

### 3.2 Recurring Transactions
- ✅ Daftar transaksi berulang dengan toggle aktif/nonaktif
- ✅ Modal tambah/edit jadwal (harian/mingguan/bulanan/tahunan)
- ✅ Kalkulasi estimasi pengeluaran & pemasukan per bulan
- ✅ Calendar preview (grouped by week)

### 3.3 AI Bot Preview (Mock UI)
- ✅ Halaman setup WhatsApp & Telegram Bot
- ✅ Live demo chat interface (10 mock messages, Framer Motion stagger)
- ✅ OCR Demo Modal (struk parser mock)
- ✅ Daftar command bot

### 3.4 Settings & Profile
- ✅ Tab Profil — edit nama, email, income, disposable, currency, bahasa, timezone
- ✅ Tab Anggota Tim — multi-user management, invite modal, role/permissions
- ✅ Tab Notifikasi — 4 channel toggles (WA/Telegram/Email/Push) + 8 preference rows
- ✅ Tab Keamanan — password form, 2FA toggle, active sessions, activity log
- ✅ Tab Data & Ekspor — PDF/CSV/JSON export UI, drag-drop import, danger zone reset

---

## Phase 4: Polish, Responsiveness & Auth

### 4.1 Auth System
- ✅ Halaman Login (email + password, mock auth)
- ✅ Halaman Register (nama, email, password)
- ✅ Auth store (useAuthStore) — login, logout, register, persistence localStorage
- ✅ Auth layout (centered, no sidebar)
- ✅ Route guard — redirect ke /login jika belum login

### 4.2 Admin Panel
- ✅ Admin dashboard (overview: users, system stats)
- ✅ Admin user management (list, create, edit, delete, roles, suspend/activate)
- ✅ Admin app-settings (nama app, logo, primary color, tag line)
- ✅ Admin layout (sidebar admin terpisah)
- ✅ Admin route guard — hanya role admin

### 4.3 App Branding
- ✅ AppConfig store (appName, logoUrl, primaryColor, tagline)
- ✅ Sidebar menggunakan nama & logo dinamis dari store
- ✅ Admin page untuk mengubah branding
- ✅ Pilihan logo: icon Lucide, text, image URL
- ✅ Color presets + live preview

### 4.4 Mobile Responsive
- ✅ SidebarStore (collapsed state, mobileOpen state)
- ✅ Sidebar: mobile drawer (slide-in overlay + backdrop)
- ✅ Topbar: hamburger button on mobile
- ✅ Dashboard layout: marginLeft responsif + mobile overlay
- ✅ Admin table responsive horizontal scroll

### 4.5 Polish
- ✅ Skeleton loading component + variants
- ✅ Page transition animations (Framer Motion)
- ✅ Dark mode penuh (dark-first design)
- ✅ Empty state komponen

---

## Phase 5: Backend & Frontend Integration

### 5.1 Backend Foundation
- ✅ Setup backend Express + TypeScript
- ✅ Struktur folder backend (`src/routes`, `src/middleware`, `src/data`)
- ✅ Health check API (`GET /api/health`)
- ✅ CORS + JSON middleware + request logger

### 5.2 Auth API
- ✅ `POST /api/auth/login`
- ✅ `POST /api/auth/register`
- ✅ `GET /api/auth/me`
- ✅ JWT token + in-memory users

### 5.3 Finance API
- ✅ `GET /api/bootstrap` untuk hydrate data frontend
- ✅ CRUD API generic untuk wallets, transactions, budgets, bills, savings, recurring, notes, dll.
- ✅ Admin API untuk users dan app settings

### 5.4 Frontend Integration
- ✅ API client frontend (`lib/api.ts`)
- ✅ Auth store pakai backend login/register dengan fallback local mock
- ✅ Finance store hydrate dari backend bootstrap
- ✅ Dashboard layout load data dari backend setelah login
- ✅ Admin app-settings save ke backend jika token backend tersedia

---

## Phase 6: PostgreSQL, Bot Integration & UI Polish

### 6.1 PostgreSQL + Prisma
- ✅ Install Prisma + PostgreSQL driver
- ✅ Schema database PostgreSQL
- ✅ Seed admin/demo user
- ✅ Ganti auth API dari in-memory ke Prisma
- ✅ Ganti app settings API ke Prisma
- ✅ Persiapan finance tables utama
- ✅ Tambah model Prisma: Debt, Card, WishlistItem, Reimbursement, TeamMember
- ✅ Tambah model Prisma: NotificationSetting, GamificationState
- ✅ Perluas User model dengan profile fields

### 6.2 WhatsApp Bot (Baileys)
- ✅ Install Baileys
- ✅ Service WhatsApp connection + QR pairing
- ✅ Endpoint status WhatsApp bot
- ✅ Endpoint send/test WhatsApp message
- ✅ Parser command transaksi sederhana
- ✅ Pairing code (alternatif QR) — input nomor telepon + tampilkan kode
- ✅ Pairing code ditampilkan di UI dalam font besar

### 6.3 Telegram Bot
- ✅ Setup Telegram token BotFather via env
- ✅ Service Telegram send/test message (env var fallback)
- ✅ Endpoint status Telegram bot
- ✅ Parser command sederhana
- ✅ Multi-user: tiap user punya token sendiri dari BotFather
- ✅ `POST /bot/telegram/config` — verifikasi + simpan token per user
- ✅ `verifyTelegramToken` — validasi token tanpa env var
- ✅ UI input bot token + chat ID + tombol Connect/Test/Update Token

### 6.4 AI Bot UI Integration
- ✅ UI AI Bot tidak hanya demo statis
- ✅ Input chat demo bisa dikirim ke backend
- ✅ Button connect/test bot memanggil backend
- ✅ OCR demo tetap mock tapi result dari endpoint backend

### 6.5 Modal UI Global Fix
- ✅ Modal center global
- ✅ Responsive max-height + scroll body
- ✅ Header/footer lebih cantik
- ✅ Fix transform/translate framer yang bikin modal tidak center

---

## Phase 7: Full DB Persistence

### 7.1 Backend CRUD untuk Semua Resource
- ✅ CRUD backend untuk debts, cards, wishlist, reimbursements, teamMembers
- ✅ User profile endpoints (`/user/profile` GET/PUT)
- ✅ Notification settings endpoints (`/user/notification-settings` GET/PUT)
- ✅ Gamification endpoints (`/user/gamification` GET/PUT)
- ✅ Bootstrap query mencakup semua resource baru

### 7.2 Store Persistence (Zustand → Backend)
- ✅ Wallets — persist ke backend via `persistResource`
- ✅ Transactions — persist ke backend via `persistResource`
- ✅ Budgets — persist ke backend via `persistResource`
- ✅ Investments — persist ke backend via `persistResource`
- ✅ Bills — persist ke backend via `persistResource`
- ✅ Saving Goals — persist ke backend via `persistResource`
- ✅ Notes — persist ke backend via `persistResource`
- ✅ Recurring Transactions — persist ke backend via `persistResource`
- ✅ Debts — persist ke backend via `persistResource`
- ✅ Cards — persist ke backend via `persistResource`
- ✅ Wishlist — persist ke backend via `persistResource`
- ✅ Reimbursements — persist ke backend via `persistResource`
- ✅ Team Members — persist ke backend via `persistResource`
- ✅ User Profile — persist ke `/user/profile` PUT
- ✅ Notification Settings — persist ke `/user/notification-settings` PUT
- ✅ Gamification — persist ke `/user/gamification` PUT

### 7.3 Investasi — UI Fix & Real-time Price
- ✅ Edit aset investasi via modal
- ✅ Refresh harga per aset dari Yahoo Finance
- ✅ Harga sekarang opsional (auto-fetch saat simpan)
- ✅ Input lot untuk saham (1 lot = 100)
- ✅ Tabel menampilkan lot, bukan lembar
- ✅ Preview nilai & P/L pakai konversi lot
- ✅ Seed investasi demo (BBCA, ANTM)

### 7.4 Next Steps (setelah db:generate)
- 🔄 Jalankan `npm run db:generate` (EPERM — file locked oleh proses node lain)
- 🔄 Jalankan `npm run db:push` untuk sinkronisasi schema
- 🔄 Jalankan `npx prisma db seed` untuk seed data baru
- 🔄 Restart backend & login ulang untuk testing

---

## Catatan Teknis

| Item | Pilihan |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Icons | Lucide React |
| State | Zustand |
| Form | React Hook Form + Zod |
| Mock Data | Static JSON / faker-js |
| Animation | Framer Motion |

---

## Log Pengerjaan

| Tanggal | Aktivitas |
|---|---|
| 2026-06-07 | Inisialisasi proyek, buat task.md, setup Next.js 16 + Tailwind v4 + semua dependensi |
| 2026-06-07 | Foundation: lib/types.ts, lib/utils.ts, lib/mock-data.ts, store/useFinanceStore.ts |
| 2026-06-07 | Design system: globals.css dengan CSS vars, Inter font, dark-mode |
| 2026-06-07 | UI Components: Button, Input, Card, Badge, Modal, ProgressBar, StatCard, EmptyState |
| 2026-06-07 | Layout: Sidebar (collapsible), Topbar, PageWrapper |
| 2026-06-07 | Charts: IncomeExpenseChart, PortfolioPieChart, SpendingTrendChart, ExpenseBreakdownChart, HeatmapCalendar |
| 2026-06-07 | Pages: Dashboard (/dashboard), Wallets, Transactions, Budget |
| 2026-06-07 | Pages: Investments, Bills, Savings, Debts, Statistics, Cards, Wishlist, Reimbursement, Notes |
| 2026-06-07 | Fix: viewport metadata warning (Next.js 16 Viewport export) |
| 2026-06-07 | Build berhasil: 14 routes static, 0 TypeScript errors |
| 2026-06-07 | Phase 3: types + mock data untuk Gamifikasi, UserProfile, TeamMember, NotificationSettings |
| 2026-06-07 | Phase 3: Store expanded — gamification, userProfile, teamMembers, notificationSettings |
| 2026-06-07 | Phase 3: Halaman /gamification (XP, badges, streak, health score, leaderboard) |
| 2026-06-07 | Phase 3: Halaman /recurring (daftar berulang, toggle, kalender, CRUD modal) |
| 2026-06-07 | Phase 3: Halaman /ai-bot (WhatsApp/Telegram setup, live chat demo, OCR modal) |
| 2026-06-07 | Phase 3: Halaman /settings (5 tabs: Profil, Tim, Notifikasi, Keamanan, Data & Ekspor) |
| 2026-06-07 | Sidebar updated: +Berulang, +Gamifikasi, +AI Bot (total 17 nav items) |
| 2026-06-07 | Build berhasil: 19 routes static, 0 TypeScript errors |
| 2026-06-07 | Phase 4: Auth system — /login, /register, useAuthStore, AuthGuard |
| 2026-06-07 | Phase 4: Admin panel — /admin dashboard, /admin/users, /admin/app-settings |
| 2026-06-07 | Phase 4: User management admin — list, filter, create/edit, suspend/activate, detail modal |
| 2026-06-07 | Phase 4: App branding — set nama app, tagline, logo icon/text/image, warna brand |
| 2026-06-07 | Phase 4: Mobile responsive — sidebar drawer, hamburger topbar, responsive layout offset |
| 2026-06-07 | Phase 4: Polish — skeleton component, page transitions Framer Motion |
| 2026-06-07 | Build berhasil: 24 routes static, 0 TypeScript errors |
| 2026-06-07 | Fix /login: form login dibuat eksplisit dengan native input agar field email/password pasti tampil |
| 2026-06-07 | Fix /login overlay: hapus motion opacity wrapper, tambah z-index, kontras card/input, auth panel kanan z-20 |
| 2026-06-07 | Fix /register overlay: rebuild register form native input + z-index/kontras sama seperti login |
| 2026-06-07 | Fix auth redirect: tambah hasHydrated pada useAuthStore dan AuthGuard agar tidak redirect sebelum localStorage hydrate |
| 2026-06-07 | Add /login query auto-login: `?email=...&password=...` otomatis submit dan redirect admin/user |
| 2026-06-07 | Fix login stuck: redirect pakai `window.location.href`, manual persist localStorage sebelum pindah route, tombol demo langsung login |
| 2026-06-07 | Fix dev network: `next dev --hostname 0.0.0.0` + `allowedDevOrigins` untuk akses via IP LAN/link-local |
| 2026-06-07 | Phase 5: Backend Express + TypeScript dibuat di `backend/` |
| 2026-06-07 | Phase 5: Auth API JWT — login/register/me dengan user admin/demo |
| 2026-06-07 | Phase 5: Finance API — bootstrap + CRUD generic + admin users/app-settings |
| 2026-06-07 | Phase 5: Frontend integrated — `lib/api.ts`, auth store pakai backend, dashboard hydrate dari backend |
| 2026-06-07 | Root scripts ditambah: dev/build frontend/backend via `package.json` monorepo |
| 2026-06-07 | Build monorepo berhasil: backend `tsc`, frontend Next build 26 routes |
| 2026-06-08 | Phase 6: Prisma schema diperluas untuk bills, saving goals, notes, recurring transactions |
| 2026-06-08 | Phase 6: Seed PostgreSQL admin/demo + data finance demo utama |
| 2026-06-08 | Phase 6: Finance API CRUD utama memakai Prisma saat `DATABASE_URL` tersedia, fallback mock tetap ada |
| 2026-06-08 | Phase 6: WhatsApp Baileys service ditambah QR data URL, start/stop, send/test, parser auto-reply |
| 2026-06-08 | Phase 6: Telegram service ditambah status getMe, send/test, webhook parser command sederhana |
| 2026-06-08 | Phase 6: AI Bot UI connect/status/QR/chat/OCR terhubung ke backend |
| 2026-06-08 | Build berhasil: backend `tsc`, frontend Next build 26 routes |
| 2026-06-08 | Konsolidasi total: frontend dipindah ke src, backend dimigrasi ke Elysia di server, root config disatukan, folder asal dibersihkan |
| 2026-06-08 | Phase 6 audit: seed Prisma dilengkapi data finance demo, endpoint Elysia bot/admin diverifikasi, build/typecheck lulus
| 2026-06-08 | Phase 7: Prisma schema diperluas — Debt, Card, WishlistItem, Reimbursement, TeamMember, NotificationSetting, GamificationState, User extended
| 2026-06-08 | Phase 7: Backend CRUD + bootstrap untuk semua resource baru
| 2026-06-08 | Phase 7: User profile, notification settings, gamification endpoints
| 2026-06-08 | Phase 7: Store persistResource untuk debts, cards, wishlist, reimbursements, teamMembers, userProfile, notificationSettings, gamification
| 2026-06-08 | Phase 7: Investasi UI fix — edit, refresh harga, lot display, preview value
| 2026-06-08 | Phase 7: WhatsApp pairing code — `startWhatsAppBotWithPairing`, input nomor telepon, tampilkan kode di UI
| 2026-06-08 | Phase 7: Telegram multi-user — `verifyTelegramToken`, `POST /bot/telegram/config`, simpan per-user ke NotificationSetting
| 2026-06-08 | Phase 7: AI Bot UI — input phone + pair button, input bot token + chat ID + connect/test button
| 2026-06-08 | Phase 8: Bot permission system — model BotPermission, CRUD API, kontak dari WA/TG, seleksi dengan search, permission check di handleIncomingMessage |
| 2026-06-14 | White-label pass 1 — `ai-bot/page.tsx`: 3 hardcoded "FinTrack" (`@FinTrackBot` handle, "WhatsApp FinTrack", "FinTrack Bot", toast test) diganti `config.appName` via `useAppConfigStore`; helper `fallbackTelegramHandle(appName)` derive dari brand |
| 2026-06-14 | White-label pass 2 — `src/app/layout.tsx`: tambah `APP_NAME` server env (default "FinTrack", `??` fallback untuk path `SKIP_ENV_VALIDATION` di Docker) untuk metadata `<title>`, `authors`, `creator`, `og.title`, `og.siteName` |
| 2026-06-14 | White-label pass 3 — `src/app/pay/[id]/[token]/page.tsx`: backend return `appName` di public bill context (AppSetting → in-memory `appConfig` fallback chain, sama dengan `qrisStatic`); 2 hardcoded "FinTrack" (header brand + warning QRIS) diganti `{data.appName}`; tipe `PublicSplitBill` di `src/lib/api.ts` diperbarui |
| 2026-06-14 | Docker infra — `docker-entrypoint.sh`: auto-sync DB schema via `npx prisma db push --skip-generate --accept-data-loss` sebelum backend start (skip jika `SKIP_PRISMA_PUSH=1` atau `DATABASE_URL` kosong; gagal → warning, container tetap start) |
| 2026-06-14 | Docker infra — `docker-compose.yml`: tambah `logging.driver: json-file` dengan `max-size: 10m` + `max-file: 5` agar log container tidak memenuhi disk |
| 2026-06-14 | TypeScript cleanup — `server/services/whatsapp.ts` line 302 & 811: `downloadMediaMessage(message, ...)` cast ke `message as any` (local `message` adalah narrow mirror of `WAMessage` di listener; runtime aman karena `key` sudah difilter di atas). `npx tsc --noEmit` lulus 0 error, `npm run build:server` exit 0 |
| 2026-06-14 | Fix dark/light mode toggle — `src/styles/globals.css`: `@theme inline` diganti `@theme`. Bug: `inline` menyebabkan Tailwind v4 **menyimpan nilai hex langsung** ke utility class (mis. `.bg-bg-base { background-color: #0f1117; }`), sehingga toggling class `.dark` di `<html>` tidak mengubah apa-apa karena nilai sudah di-bake. Setelah fix: utility pakai `var(--color-bg-base)`, override di `:root:not(.dark)` di-resolve dengan benar. Theme toggle di topbar sekarang efektif |
| 2026-06-14 | Hilangkan icon flicker di theme toggle — `src/components/layout/topbar.tsx`: hapus `isDark` state + `useEffect` sync (yang bikin icon Sun/Moon berkedip singkat di mount pertama kalau `localStorage` value ≠ default). Sekarang 100% CSS-driven: `<Sun className="dark:hidden" />` + `<Moon className="hidden dark:block" />`. Class `.dark` di `<html>` di-set oleh `theme-init` Script (beforeInteractive) sebelum React hydrate, jadi icon selalu benar dari paint pertama. `toggleTheme` baca `document.documentElement.classList` langsung |
