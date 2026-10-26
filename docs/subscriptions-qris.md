# Langganan melalui QRIS Gateway

Integrasi tersedia di `/subscription` dan API `/api/subscriptions`. Checkout
tertutup secara default. Harga, durasi, dan manfaat paket belum ditetapkan.
`Subscription.expiresAt` menjadi dasar status langganan.

Gateway berdiri sendiri di repo
<https://github.com/afarisulhaq/qris-gateway> dan tidak lagi menjadi bagian
repo FinTrack. Kontrak integrasi mengikuti
[`docs/integrasi-website.md`](https://github.com/afarisulhaq/qris-gateway/blob/main/docs/integrasi-website.md)
di repo tersebut: `POST /v1/invoices` dengan `X-API-Key`, halaman bayar
`checkout_url`, pemeriksaan `POST /v1/invoices/:id/check`, dan webhook HMAC.

## Gateway dan konfigurasi

Jalankan gateway mengikuti README gateway (Bun, `bun run setup`, build
frontend untuk produksi, `APP_URL` origin HTTPS). Di FinTrack, buat API key
pada lingkungan yang benar di menu **API & webhook**, lalu simpan nilainya di
secret manager atau `.env` backend. Jangan memakai `NEXT_PUBLIC_` untuk key
atau secret.

```dotenv
SUBSCRIPTIONS_ENABLED=false
QRIS_BASE_URL=<origin gateway, contoh https://pay.example.com>
QRIS_API_KEY=<API key gateway, minimal 16 karakter>
QRIS_ENVIRONMENT=sandbox
QRIS_PROVIDER=gopay
QRIS_CONNECTION_ID=<ID dompet, wajib saat QRIS_ENVIRONMENT=production>
QRIS_WEBHOOK_SECRETS=<secret webhook, dipisah koma, opsional>
SUBSCRIPTION_PLAN_NAME=<nama paket>
SUBSCRIPTION_PRICE_IDR=<harga dasar dalam rupiah bulat>
SUBSCRIPTION_DURATION_DAYS=<jumlah hari, 1 sampai 366>
```

- `QRIS_BASE_URL` harus origin yang sama dengan `APP_URL` gateway agar
  `checkout_url` tervalidasi. Produksi wajib HTTPS; hanya `localhost`,
  `127.0.0.1`, dan `[::1]` yang boleh HTTP untuk pengujian lokal.
- `QRIS_ENVIRONMENT` harus sama dengan environment API key; key sandbox tidak
  dapat membaca invoice produksi dan sebaliknya.
- `QRIS_CONNECTION_ID` wajib diisi pada produksi (ambil lewat
  `GET /v1/connections`) dan dikosongkan pada sandbox.
- Validasi URL, environment, provider, API key, dan kewajiban connection ID
  produksi dipakai bersama oleh konfigurasi langganan dan Split Bills agar
  kedua alur menolak konfigurasi berbahaya dengan aturan yang sama.
- `QRIS_WEBHOOK_SECRETS` berbeda dari API key. Saat secret dirotasi di
  dashboard gateway, pertahankan secret lama di daftar sampai antrean event
  lama selesai.
- Tanpa webhook, pembayaran tetap terkonfirmasi lewat pemeriksaan manual;
  webhook hanya mempercepat status lunas tanpa klik pengguna.

## Split Bills memakai gateway per pengguna

Langganan tetap memakai variabel `QRIS_BASE_URL`, `QRIS_API_KEY`,
`QRIS_ENVIRONMENT`, `QRIS_PROVIDER`, dan `QRIS_CONNECTION_ID` di backend.
Split Bills tidak memakai kredensial langganan tersebut. Setiap pemilik akun
menyimpan konfigurasi gateway sendiri melalui API berikut:

- `GET /api/user/qris-gateway-settings` membaca konfigurasi pengguna aktif.
- `PUT /api/user/qris-gateway-settings` menerima `baseUrl`, `environment`,
  `provider`, `connectionId`, dan `apiKey` opsional. Jika `apiKey` tidak dikirim
  saat pembaruan, key tersimpan tetap digunakan.
- Kedua respons hanya berisi `configured`, `baseUrl`, `environment`, `provider`,
  `connectionId`, dan `apiKeyMasked`. Plaintext API key tidak pernah dikirim.

`QRIS_SETTINGS_ENCRYPTION_KEY` wajib berisi 32 byte yang dikodekan sebagai
base64 atau 64 karakter heksadesimal. FinTrack mengenkripsi API key pengguna
dengan AES-256-GCM sebelum menyimpannya. Nilai key harus disimpan di secret
manager, tidak memakai awalan `NEXT_PUBLIC_`, dan harus tetap sama selama data
terenkripsi masih dipakai. Mengganti atau kehilangan key membuat kredensial
lama tidak dapat dibuka; pengguna perlu menyimpan ulang API key setelah rotasi
yang disengaja.

Pemilik membuat invoice peserta lewat
`POST /api/split-bills/:id/participants/:participantId/qris-invoice`. Backend
memastikan tagihan dan peserta dimiliki pengguna yang sedang login, lalu
mengembalikan `amount`, `qrisCode`, `checkoutUrl`, dan `expiresAt`. Invoice
berstatus pending yang belum kedaluwarsa digunakan kembali agar klik berulang
tidak membuka invoice kedua di gateway. Halaman pembayaran publik hanya
menerima objek aman `qrisPayment` untuk peserta pada link tersebut. Endpoint
publik tidak lagi mengirim `staticQris`.

QRIS statis di Pengaturan App tetap disimpan dan ditampilkan oleh UI yang sudah
ada, tetapi tidak lagi menjadi sumber pembayaran Split Bills. Terapkan
`prisma/patches/20261026-split-bills-qris-gateway.sql` sebelum mengaktifkan alur
gateway per pengguna.

Sebelum membuka checkout, tentukan manfaat serta ketentuan paket, uji
pembayaran nominal kecil pada sandbox, baru ubah `SUBSCRIPTIONS_ENABLED=true`.
Landing page tetap menyatakan paket belum tersedia sampai harga dan penjualan
benar-benar diluncurkan. Jangan mengaktifkan checkout produksi dengan key
sandbox: langganan yang aktif berasal dari status lunas yang diterima backend.

## Alur pembayaran

1. `createInvoice` membuat baris invoice lokal (status `creating`) lalu memanggil
   `POST /v1/invoices` dengan `external_id` stabil
   `fintrack:<environment>:<invoiceId>`. Percobaan ulang memakai referensi,
   nominal, dan keterangan yang sama sehingga gateway me-replay invoice yang
   sama, bukan membuat yang kedua.
2. FinTrack mengirim `amount` = harga dasar. Gateway menambahkan kode unik
   (Rp0 sampai Rp99) dan hasilnya disimpan sebagai `amount` invoice FinTrack
   (`payable_amount`). Total inilah yang ditampilkan dan dibayar pelanggan;
   FinTrack tidak pernah mengubahnya sendiri.
3. Pelanggan memindai QR dari `qr_code` di halaman Langganan, atau membuka
   `checkout_url` di tab baru. Gateway tidak mengembalikan browser ke toko,
   jadi halaman Langganan memberi petunjuk untuk kembali dan memeriksa status.
4. Status lunas datang dari dua jalur: webhook `invoice.paid` (aktif
   otomatis) dan `POST /api/subscriptions/invoices/:id/check` yang memanggil
   `POST /v1/invoices/:id/check` (paling cepat setiap 15 detik). Keduanya
   diarahkan ke aktivasi `pending -> paid` yang idempoten dalam satu
   transaksi PostgreSQL, jadi event ganda atau klik berulang tidak menambah
   masa berlaku dua kali.
5. `invoice.cancelled` dan `invoice.failed` menutup invoice lokal.
   `invoice.expired` tidak menyimpan status apa pun: status kedaluwarsa
   diturunkan dari waktu lokal supaya pembayaran tepat waktu yang terverifikasi
   telat masih bisa mengaktifkan langganan hingga 24 jam setelah batas.

## Webhook

Receiver FinTrack: `POST /api/webhooks/qris`, umum diakses lewat rewrite
`/api/*` sebagai `https://<domain>/api/webhooks/qris`. Isi URL tersebut dan
secretnya pada **API & webhook** gateway di environment yang sama, lalu isi
`QRIS_WEBHOOK_SECRETS` di backend. Gateway menolak localhost dan IP privat
untuk URL webhook, jadi receiver ini baru berfungsi di balik HTTPS publik.

Urutan penerimaan sesuai panduan gateway: baca byte mentah, verifikasi
HMAC-SHA256 `X-QRIS-Signature` dengan perbandingan constant-time, parse JSON,
cocokkan `X-QRIS-Event-Id`, `X-QRIS-Environment`, event, environment,
`external_id`, nominal, dompet, dan konfigurasi, lalu simpan status dan
balas `204`. Signature salah mendapat `401`; data tidak cocok mendapat `409`
sehingga gateway mengirim ulang. Tidak ada tabel deduplikasi: transisi status
lokal idempoten, jadi pengiriman at-least-once aman.

## Database

Generate client saat build/install dengan `npm run db:generate`. Terapkan
patch melalui proses deployment database yang biasa digunakan proyek:

1. `prisma/patches/20261008-subscriptions.sql` membuat tabel langganan.
2. `prisma/patches/20261020-subscriptions-qris-v1-api.sql` menyesuaikan
   kontrak `/v1`: kolom `checkoutUrl` baru, penghapusan unique nominal lokal
   dan `providerTransactionId`, serta CHECK `amount >= baseAmount`.

Patch kedua wajib dijalankan di semua lingkungan yang menjalankan patch
pertama, termasuk database development: CHECK lama menolak total yang sama
dengan harga dasar. Jangan menjalankan `db push` pada database produksi untuk
perubahan ini.

## Verifikasi dan batasan

- Harga dan durasi diambil dari konfigurasi backend dan disalin ke invoice;
  nominal bayar berasal dari `payable_amount` respons gateway, divalidasi
  berada di `amount` sampai `amount + 99`.
- Payload QR produksi divalidasi: CRC16 benar, IDR (360), negara ID, metode
  dinamis (12), dan nominal persis `payable_amount`. QR sandbox berisi tautan
  checkout uji dan tidak divalidasi sebagai payload QRIS.
- `checkout_url` wajib berorigin sama dengan `QRIS_BASE_URL` dan berpath
  `/pay/`; respons yang melanggar ditolak sebagai 502 dan invoice dicoba
  ulang dengan referensi yang sama.
- Satu invoice terbuka digunakan kembali. Maksimal tiga invoice baru per akun
  per jam; pemeriksaan paling cepat setiap 15 detik, tanpa polling otomatis.
- Pembuatan yang gagal karena jaringan, `409`, `429`, atau `5xx` mempertahankan
  baris `creating` untuk replay idempoten; penolakan data (`400`, `401`,
  `403`, `404`) menutup invoice sebagai `failed`.
- Aktivasi memeriksa waktu lunas berada di rentang invoice dan tidak pernah
  menurunkan status `paid`. Invoice terikat ke URL, environment, dan dompet
  saat dibuat; perubahan konfigurasi menutup verifikasi invoice lama.
- Refund setelah aktivasi belum mencabut langganan otomatis; perlu proses
  manual. Pemeriksaan yang lewat dari 24 jam juga perlu proses manual.
- Browser tidak pernah menerima API key atau secret: semua panggilan gateway
  terjadi di backend, dan status akhir selalu dibaca dari database FinTrack.

## Pengujian

`tests/subscriptions.integration.ts` hanya boleh dijalankan pada PostgreSQL
sementara dengan user `fintrack_test` dan port `55432`. Gateway dimock pada
batas HTTP.

```sh
DATABASE_URL=postgresql://fintrack_test@127.0.0.1:55432/postgres npx tsx tests/subscriptions.integration.ts
```

Tes ini tidak membuktikan sesi provider, QRIS merchant, atau pembayaran bank
nyata berfungsi. Ketiganya harus diuji setelah gateway dan akun merchant
tersedia.

## QA perubahan (2026-10-20)

- `tsc --noEmit`, `next lint`, `prettier --check` pada file yang diubah, `tsc -p
  server/tsconfig.json`, dan `next build` lolos.
- `tests/subscriptions.integration.ts` lolos pada PostgreSQL port 55432 dengan
  gateway di-mock di batas HTTP: konfigurasi (HTTPS, environment, `connection_id`
  produksi), create idempoten lewat `external_id`, total payable dan validasi QR,
  origin `checkout_url`, riwayat/pagination, jeda 15 detik, aktivasi lunas
  idempoten, perpanjangan tepat satu periode, replay setelah jaringan putus,
  rekonsiliasi respons hilang (satu invoice gateway untuk dua percobaan),
  penolakan permanen 4xx menutup invoice, perubahan konfigurasi menutup
  verifikasi, serta webhook: signature salah 401, body diubah 401, header
  event/environment 400, referensi/nominal 409, event ganda 204 tanpa aktivasi
  ganda, event sebelum create disimpan ditolak 409 lalu berhasil saat retry.
- Smoke E2E terhadap gateway asli (repo `afarisulhaq/qris-gateway`, mode
  sandbox, data terisolasi): `POST /v1/invoices` menghasilkan invoice pending
  dengan `checkout_url` `/pay/` origin sama, halaman checkout terbuka tanpa
  login, `POST /v1/invoices/:id/simulate` lunas, lalu `/check` dari FinTrack
  mengaktifkan langganan satu kali dan pemeriksaan ulang tidak menambah masa
  berlaku. Sandbox gateway menghasilkan `payable_amount == amount` (kode unik 0),
  yang diblokir CHECK lama `amount > baseAmount`; patch 20261020 menggantinya
  dengan `>=`. Kedua patch berjalan idempoten pada database hasil `db push`.
- Browser nyata (headless Chromium) pada `/subscription`: login, copy nominal
  Rp0..Rp99, Buat invoice QRIS -> status pending dengan QR SVG, hitung mundur,
  tautan checkout, dan petunjuk kembali; tautan membuka halaman checkout gateway
  di tab baru (judul dan label sandbox terbaca); tombol simulator lunas di
  gateway lalu Periksa pembayaran di FinTrack menampilkan Lunas dan perpanjangan
  tepat 30 hari dari masa berlaku sebelumnya; invoice kedaluwarsa menampilkan
  status beserta tombol periksa. Tanpa exception JavaScript pada alur ini.
- Batas: pengiriman webhook HTTPS publik tidak diuji (gateway menolak URL
  lokal; receiver dibuktikan lewat payload bertanda tangan pada tes), pembayaran
  provider nyata tidak diuji, dan build gateway dijalankan dari checkout sumber,
  bukan dari image Docker.
