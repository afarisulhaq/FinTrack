# Pemeriksaan QRIS Gateway — 2026-10-08

Lingkup: aplikasi terpisah di `qris-gateway`, dashboard admin, checkout publik,
dan kontrak API yang dipakai adapter langganan FinTrack. Akun GoBiz dan pembayaran
bank nyata tidak dipakai dalam pengujian ini.

## Hard Gate — PASS

- Statistik ringkasan berasal dari invoice SQLite. Total diberi label sebagai
  pembayaran invoice tercatat, bukan saldo merchant. Tidak ada angka pengguna,
  uptime, rating, atau harga paket rekaan.
- Semua tindakan dashboard terhubung ke backend. Kondisi awal meminta setup
  admin/koneksi merchant sebelum invoice bisa dibuat. Kredensial tidak diprefill.
- Kontras teks yang diperiksa dengan `antislop-human/contrast-check.py`:
  teks pendukung terang 6,94:1; gelap 7,12:1; tombol utama 11,52:1; teks error
  6,21:1; status lunas 6,07:1. QR hitam/putih dengan quiet zone.
- Form berlabel, pesan error memakai alert, hasil tindakan memakai status,
  fokus keyboard terlihat, dialog mendukung Escape. Escape menghapus nilai API
  key dari input dialog. Tombol keluar tersedia juga di layar ponsel.

## Purpose Gate — PASS

- Permukaan datar dan garis ledger memisahkan angka, invoice, dan koneksi.
  Bayangan hanya pada modal untuk membedakannya dari konten di belakang.
- Aksen emas menandai tindakan utama pembayaran dan koneksi. Status lunas/error
  menggunakan warna semantik dengan teks, sehingga warna bukan satu-satunya tanda.
- Angka tabular membantu membandingkan total. Monospace terbatas untuk payload,
  ID, dan contoh API. Tidak ada ikon atau ilustrasi dekoratif baru.

## Liveliness — PASS

- Mengikuti DESIGN.md: ENERGY 2 / RHYTHM 2 / MOTION 1, stone/charcoal, angka tegas,
  aksen emas, radius 6/8/12/16 piksel. Typeface Inter dengan system fallback.
- Fokus ringkasan adalah total invoice lunas; fokus checkout adalah nominal dan
  QR; fokus koneksi adalah form OTP dan konfigurasi merchant.
- Ledger, pemisah garis, dan angka tabular menjadi motif berulang. Ruang memisahkan
  summary, tabel, dan aktivitas; transisi singkat hanya pada tombol.

## Craftsmanship — PASS

- `npm run check` dan `npm test` pada package gateway lolos. Tes mencakup QRIS CRC,
  sesi admin, Origin/CSRF, OTP simulasi, penyimpanan sesi terenkripsi, isolasi
  invoice antar API key, idempotency, nominal unik, refund, settlement, klaim
  transaksi ganda, hasil ambigu, kedaluwarsa, revocation, dan persistensi SQLite.
- Adapter TypeScript FinTrack dijalankan langsung terhadap gateway HTTP baru
  dengan merchant simulasi: `/create-qris` menjaga nominal persis, payload lolos
  validator FinTrack, dan `/transactions` menghasilkan kandidat pembayaran valid.
- Chromium memeriksa alur login, OTP simulasi, simpan konfigurasi, invoice, gambar
  QR, pemeriksaan lunas, checkout publik, salin/cabut key, sinkronisasi mutasi,
  dan logout. Lima halaman dashboard pada 360/768/1440 piksel dengan tema terang
  dan gelap: 30 kombinasi, tanpa overflow halaman atau error JavaScript. Checkout
  juga diperiksa pada enam kombinasi ukuran/tema. Tabel panjang dapat digeser
  di dalam kontainernya pada ponsel.
- Screenshot ringkasan desktop terang, ponsel gelap, dan checkout menunggu
  diperiksa secara visual. Konten pembayaran pada screenshot diberi label simulasi.
- Setup admin diuji melalui terminal interaktif pada direktori `/tmp`; kedua
  input password disembunyikan. Tidak ada akun admin dibuat di data produksi.
- `npm run typecheck` FinTrack dan validasi `docker compose config --quiet` lolos.
  Format source gateway diperiksa dengan Prettier. Image Docker berhasil dibuild
  melalui Compose utama; smoke test container sementara memeriksa startup SQLite,
  halaman dashboard, healthcheck, dan penolakan sesi tanpa login. Konfigurasi
  publik/HTTPS dan reverse proxy belum dideploy.

Tes simulasi tidak membuktikan login GoBiz, QRIS merchant, atau bank menerima
pembayaran. Ketiganya harus diverifikasi dengan akun merchant sebelum peluncuran.
Pembatasan 999 nominal, jendela pembayaran lokal, hasil mutasi maksimal 100,
dan penanganan refund manual dijelaskan dalam README.

## Compose utama FinTrack

Service `app` dan `qris-gateway` tersedia dalam Compose utama. Validasi konfigurasi
memastikan URL internal `http://qris-gateway:3010`, dependency healthcheck, binding
dashboard hanya ke localhost, dan volume gateway tersendiri. Build TypeScript
backend dan tes integrasi langganan PostgreSQL sementara lolos; hostname internal
diterima sementara gateway HTTP jarak jauh tetap ditolak.
