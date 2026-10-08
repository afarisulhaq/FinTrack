# Langganan melalui GoPay Merchant Gateway

Integrasi sudah tersedia di `/subscription` dan API `/api/subscriptions`. Checkout
tertutup secara default. Harga, durasi, dan manfaat paket belum ditetapkan. Tidak
ada fitur gratis yang dibatasi oleh perubahan ini; `Subscription.expiresAt` menjadi
dasar status langganan untuk aturan akses yang ditentukan kemudian.

## Gateway dan konfigurasi

Gateway terpisah tersedia di [`qris-gateway`](../qris-gateway/README.md), dengan
dashboard admin, koneksi OTP GoBiz, invoice, mutasi, dan API key. Adapter mengikuti
kontrak repo <https://github.com/ahmadzakiyox/gopay-api-gateaway>; kode obfuscated
upstream tidak dijalankan. Jalankan layanan dengan penyimpanan `data/` permanen.
Login OTP dilakukan sendiri di dashboard gateway, bukan melalui FinTrack atau
chat. Buat API key bernama FinTrack pada menu API & integrasi. Pakai
merchant khusus gateway: pencocokan mutasi tidak mempunyai referensi
invoice bank, sehingga transaksi dari jual beli lain dapat menimbulkan kecocokan
nominal yang salah. Gateway ini merupakan integrasi tidak resmi.

Docker Compose utama sudah menyertakan service `qris-gateway`. Jalankan
`docker compose --env-file .env.production up -d --build`, lalu buat admin gateway
sekali dengan `docker compose --env-file .env.production exec qris-gateway npm run setup`.
FinTrack otomatis memakai `http://qris-gateway:3010` melalui jaringan Compose.
Isi API key, merchant, dan konfigurasi paket pada `.env.production`, lalu
jalankan kembali Compose agar backend membaca nilai baru.

Isi variabel berikut di lingkungan **backend**. Jangan gunakan awalan
`NEXT_PUBLIC_` untuk API key atau kredensial merchant.

```dotenv
SUBSCRIPTIONS_ENABLED=false
GOPAY_GATEWAY_URL=http://127.0.0.1:3010
GOPAY_GATEWAY_API_KEY=<API key gateway, minimal 16 karakter>
GOPAY_GATEWAY_MERCHANT_ID=<merchant ID yang diatur pada dashboard gateway>
GOPAY_DEDICATED_MERCHANT=true
SUBSCRIPTION_PLAN_NAME=<nama paket>
SUBSCRIPTION_PRICE_IDR=<harga dasar dalam rupiah bulat>
SUBSCRIPTION_DURATION_DAYS=<jumlah hari, 1 sampai 366>
```

URL gateway jarak jauh harus HTTPS; hostname `qris-gateway` diizinkan melalui HTTP
untuk service internal Compose. Gateway menerima header `X-Api-Key` dan
`X-Gopay-Merchant-Id`. Tidak ada kredensial atau URL checkout gateway yang dikirim
ke browser. QR dirender lokal dengan `qrcode.react`, tanpa layanan gambar QR pihak
ketiga. Backend memakai `POST /create-qris` dan `GET /transactions`.

Sebelum membuka checkout, tentukan manfaat serta ketentuan paket, pastikan merchant
dan QRIS sesuai, lalu uji pembayaran nominal kecil serta refund pada akun merchant.
Baru kemudian ubah `SUBSCRIPTIONS_ENABLED=true`. Landing page tetap menyatakan
paket belum tersedia sampai harga dan penjualan benar-benar diluncurkan.

## Database

Generate client saat build/install dengan `npm run db:generate`. Terapkan patch
`prisma/patches/20261008-subscriptions.sql` melalui proses deployment database yang
biasa digunakan proyek. Patch menambah dua tabel tanpa mengubah data keuangan.
Jangan menjalankan `db push` pada database produksi untuk perubahan ini.

## Verifikasi dan batasan

- Harga dan durasi diambil dari konfigurasi backend dan disalin ke invoice.
- Payload QRIS harus memiliki checksum CRC16 yang benar, IDR (360), negara ID,
  metode dinamis (12), dan nominal yang persis sama dengan invoice.
- Tambahan Rp1 sampai Rp999 termasuk dalam total yang ditampilkan sebelum bayar.
  Nominal invoice tidak pernah digunakan kembali, termasuk invoice gagal atau
  kedaluwarsa. Ini sengaja membatasi maksimal 999 nominal per rentang harga dasar;
  nominal habis menutup pembuatan invoice. Jangan hapus riwayat invoice untuk
  mengosongkan rentang. Untuk volume lebih besar, gunakan provider yang memiliki
  referensi order pada transaksi atau lakukan rekonsiliasi manual yang dirancang
  terpisah. Penggantian harga tidak boleh dianggap sebagai reset jaminan pencocokan.
- Satu invoice terbuka digunakan kembali. Maksimal tiga invoice baru per akun per
  jam; pemeriksaan paling cepat setiap 15 detik, tanpa polling GoPay otomatis.
- Hanya mutasi `settlement` atau `capture` dengan ID transaksi, nominal bulat, dan
  waktu dalam jendela invoice yang diterima. `refund`, `partial_refund`, `pending`,
  status kosong atau `success` yang tidak eksplisit tidak mengaktifkan paket.
- Dua mutasi yang cocok atau hasil 100 mutasi ditolak untuk aktivasi otomatis.
  Gateway tidak menyediakan pagination yang cukup untuk membuktikan hasil lengkap.
- Jendela pembayaran maksimal lima menit. Batas waktu bersifat lokal: QR lama
  mungkin masih bisa dibayar lewat bank. Pembayaran terlambat perlu rekonsiliasi
  manual. Pembayaran tepat waktu yang terlambat tampil di mutasi bisa dicek sampai
  24 jam setelah batas waktu, dengan waktu pembayaran tetap harus sebelum batas.
- Klaim ID transaksi unik dan aktivasi/perpanjangan berada dalam satu transaksi
  PostgreSQL. Pengulangan pemeriksaan tidak menambah masa berlaku dua kali.
- Perpanjangan menambah jumlah hari dari masa berlaku aktif; akun kedaluwarsa
  dihitung dari waktu aktivasi. Ini bukan auto-debit.
- Invoice terikat ke URL gateway dan merchant awal. Perubahan akun menutup
  verifikasi invoice lama sampai konfigurasi semula dipulihkan.
- Refund setelah aktivasi belum mencabut langganan otomatis; perlu proses manual.
  Pemeriksaan yang lewat dari 24 jam juga perlu proses manual.
- Tidak ada webhook publik untuk menandai lunas; browser tidak dapat mengirim
  nominal, status paid, atau periode langganan.

## Pengujian

`tests/subscriptions.integration.ts` hanya boleh dijalankan pada PostgreSQL
sementara dengan user `fintrack_test` dan port `55432`. Gateway dimock pada batas
HTTP. Tes meliputi kepemilikan invoice, pembayaran paralel, refund, nominal/waktu
salah, respons ambigu, klaim ganda, perpanjangan, penyimpanan setelah reconnect,
gateway gagal, pergantian merchant, dan checkout yang belum dikonfigurasi.

```sh
DATABASE_URL=postgresql://fintrack_test@127.0.0.1:55432/postgres npx tsx tests/subscriptions.integration.ts
```

Tes ini tidak membuktikan sesi GoBiz, QRIS merchant, atau pembayaran bank nyata
berfungsi. Ketiganya harus diuji setelah gateway dan akun merchant tersedia.

## QA perubahan (2026-10-08)

- Hard Gate PASS: halaman baru tidak memuat statistik atau fitur rekaan; harga
  berasal dari konfigurasi. Browser memeriksa kondisi kosong, error, kedaluwarsa,
  lunas, keyboard, dan enam kombinasi tema/ukuran tanpa overflow atau error JS.
  Kontras teks yang diperiksa minimal 6,93:1.
- Purpose Gate PASS: permukaan datar memisahkan status akun, rincian invoice, dan
  riwayat. QR hitam/putih untuk pemindaian; aksen emas pada tindakan pembayaran.
  Ikon kartu di navigasi menandai pembayaran; tidak ada ikon dekoratif baru.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 mengikuti DESIGN.md. Nominal total
  dan QR menjadi fokus pembayaran, rincian memakai angka tabular, dua kolom
  bertumpuk di layar sempit, transisi mengikuti komponen tombol proyek.
- Craftsmanship PASS: build web dan server, TypeScript, lint file perubahan,
  format, patch SQL pada schema kosong, uji integrasi PostgreSQL/gateway mock,
  serta browser pada 360/768/1440 piksel tema terang/gelap lolos. Pembayaran bank
  nyata dan gateway merchant belum diuji. Laporan ini mencakup halaman dan alur
  langganan baru, bukan audit semua halaman lama.
