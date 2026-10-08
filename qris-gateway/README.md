# QRIS Gateway

Layanan terpisah untuk satu merchant, dengan dashboard admin dan API untuk beberapa
aplikasi backend. FinTrack dapat menggunakannya untuk checkout langganan. Gateway
tidak menentukan harga atau manfaat paket FinTrack.

## Jalankan lokal

Memerlukan Node.js 22.13 atau lebih baru. Dari folder proyek FinTrack:

```sh
cd qris-gateway
npm ci --ignore-scripts
cp .env.example .env
npm run setup
npm start
```

Buka `http://127.0.0.1:3010`. Setup meminta nama login admin dan password minimal
12 karakter melalui terminal; password disembunyikan. Akun admin ini terpisah
dari akun merchant GoBiz. Setup tidak menimpa admin yang sudah ada.

Pada dashboard:

1. Buka **Koneksi merchant**, masukkan nomor HP GoBiz, kirim OTP, lalu masukkan
   kode empat digit dari GoBiz.
2. Isi merchant ID dan payload QRIS statis dari merchant yang sama. Payload adalah
   teks hasil pembacaan QR, bukan gambar atau URL. Checksum, mata uang, dan negara
   diperiksa sebelum disimpan.
3. Gunakan merchant khusus gateway dan konfirmasi konfigurasi. Merchant ID tidak
   dapat diganti setelah ada invoice.
4. Buat invoice percobaan; dashboard menampilkan total, tambahan nominal unik,
   QRIS, batas pembayaran, dan halaman bayar yang dapat dibagikan.
5. Buat API key pada **API & integrasi**. Simpan nilainya di backend aplikasi.
   Nilai lengkap hanya ditampilkan sekali; key dapat dicabut melalui dashboard.

Menu **Mutasi** mengambil transaksi merchant dari GoPay. **Periksa pembayaran**
mencocokkan invoice dengan mutasi. Tidak ada polling merchant otomatis atau
webhook. Aplikasi backend dapat memanggil endpoint pemeriksaan dengan batas
minimal 15 detik per invoice dan 10 permintaan mutasi/pemeriksaan per menit
untuk seluruh merchant.

## API

Autentikasi memakai `X-Api-Key`. Header `X-Gopay-Merchant-Id` opsional; bila diisi,
harus cocok dengan konfigurasi gateway. Tidak ada CORS lintas origin: panggil API
dari backend, bukan browser. API key dapat membaca mutasi seluruh merchant,
tetapi hanya dapat membaca invoice yang dibuat dengan key tersebut.

| Metode | Endpoint                 | Kegunaan                                                     |
| ------ | ------------------------ | ------------------------------------------------------------ |
| GET    | `/health`                | Status proses, tanpa autentikasi                             |
| POST   | `/v1/invoices`           | Buat invoice, dengan tambahan nominal unik                   |
| GET    | `/v1/invoices`           | 100 invoice terbaru milik API key                            |
| GET    | `/v1/invoices/:id`       | Rincian dan status invoice milik API key                     |
| POST   | `/v1/invoices/:id/check` | Periksa pembayaran melalui mutasi GoPay                      |
| POST   | `/create-qris`           | Kompatibilitas FinTrack: nominal persis tanpa tambahan kedua |
| GET    | `/transactions`          | Kompatibilitas mutasi; `startTime`/`endTime` Unix detik      |
| GET    | `/pay/:id`               | Halaman bayar publik bagi pemegang link invoice              |

Contoh permintaan dari backend; isi variabel dengan konfigurasi aplikasi:

```sh
curl "$QRIS_GATEWAY_URL/v1/invoices" \
  -H "X-Api-Key: $QRIS_GATEWAY_API_KEY" \
  -H "Idempotency-Key: $ORDER_ID" \
  -H 'Content-Type: application/json' \
  --data '{"amount":29000,"reference":"order-example","description":"Contoh pembayaran"}'
```

`amount` harus angka rupiah bulat, 1–100.000.000. `reference` maksimal 120 karakter,
`description` maksimal 300 karakter. Gunakan `Idempotency-Key` yang sama saat
mengulang permintaan dengan isi yang sama. Isi berbeda untuk key yang sama ditolak.
Maksimal 60 permintaan pembuatan invoice per API key per jam. Semua nominal di
contoh adalah contoh API, bukan harga paket FinTrack.

Respons sukses berbentuk `{ "success": true, "data": ... }`. Invoice berisi:

| Field                                    | Isi                                                |
| ---------------------------------------- | -------------------------------------------------- |
| `id`, `trx_id`, `qris_id`                | UUID invoice yang sama                             |
| `base_amount`, `unique_amount`, `amount` | Harga dasar, tambahan nominal unik, total bayar    |
| `status`                                 | `pending`, `paid`, atau `expired`                  |
| `qris_code`                              | Payload QRIS; `null` setelah lunas/kedaluwarsa     |
| `qris_url`                               | URL halaman pembayaran publik                      |
| `created_at`, `expires_at`, `paid_at`    | Waktu ISO 8601; `paid_at` kosong sebelum lunas     |
| `transaction_id`                         | ID mutasi yang telah diklaim, kosong sebelum lunas |

Respons gagal berbentuk `{ "success": false, "error": "..." }` dengan status HTTP
non-2xx. Invoice tidak bisa ditandai lunas oleh permintaan klien. Hanya `settlement`
atau `capture` dengan nominal dan waktu yang cocok dapat melunaskan invoice.

Halaman bayar dan endpoint `/public/invoices/:id` dapat dibuka tanpa API key oleh
pemegang UUID/link invoice, termasuk pemeriksaan pembayaran. Jangan menyimpan
informasi pribadi sensitif dalam referensi atau keterangan invoice.

## FinTrack

Buat API key FinTrack melalui dashboard. Isi variabel backend FinTrack:

```dotenv
GOPAY_GATEWAY_URL=http://127.0.0.1:3010
GOPAY_GATEWAY_API_KEY=<API key dari dashboard>
GOPAY_GATEWAY_MERCHANT_ID=<merchant ID yang sama>
GOPAY_DEDICATED_MERCHANT=true
SUBSCRIPTIONS_ENABLED=false
```

FinTrack menentukan nominal unik sendiri dan memakai `/create-qris`, sehingga
gateway tidak menambahkan nominal unik kedua kali. Nominal yang pernah digunakan
gateway ditolak, termasuk nominal dari aplikasi lain. Lihat
[panduan langganan FinTrack](../docs/subscriptions-qris.md) untuk harga, durasi,
patch database, dan langkah membuka checkout. Harga belum ditetapkan dan checkout
tetap dinonaktifkan secara default.

## Server dan penyimpanan

`PUBLIC_URL` harus sama dengan origin yang dibuka di browser. HTTP hanya diterima
untuk localhost. Untuk domain publik, gunakan reverse proxy HTTPS, atur
`PUBLIC_URL=https://<domain-gateway>` dan `SECURE_COOKIES=true`. Bind localhost
secara default; set `HOST=0.0.0.0` hanya bila perlu di jaringan/container.

Docker Compose utama FinTrack menjalankan kedua layanan sekaligus. Dari folder
utama FinTrack, isi `.env.production` mengikuti `.env.production.example`, lalu:

```sh
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production exec qris-gateway npm run setup
```

Setup admin hanya sekali. FinTrack tersedia pada port 3000, dashboard gateway pada
`http://127.0.0.1:3010`. FinTrack otomatis memakai `http://qris-gateway:3010` di
jaringan Compose; jangan memakai localhost untuk komunikasi antar container.
Gateway mempunyai healthcheck dan volume `qris-gateway-data` tersendiri. Gateway
menyala sebelum FinTrack mulai, tanpa membutuhkan akun merchant untuk healthcheck.

Untuk domain gateway publik, isi `QRIS_GATEWAY_PUBLIC_URL` dengan origin HTTPS
dan `QRIS_GATEWAY_SECURE_COOKIES=true` di `.env.production`. Pasang reverse proxy
ke port localhost 3010. Bila mengubah `QRIS_GATEWAY_PORT`, sesuaikan juga port
pada `QRIS_GATEWAY_PUBLIC_URL` saat menggunakan localhost.

Jika sebelumnya menjalankan Compose standalone, volume datanya berbeda dari
Compose utama. Pindahkan seluruh direktori data melalui backup saat gateway lama
berhenti, sebelum membuka gateway baru; jangan menjalankan dua gateway untuk
merchant yang sama dengan riwayat invoice terpisah.

Untuk menjalankan gateway saja, Compose standalone juga tersedia:

```sh
cd qris-gateway
cp .env.example .env
docker compose up -d --build
docker compose exec gateway npm run setup
```

Port host terikat ke `127.0.0.1:3010`; letakkan reverse proxy di depannya. Compose
memakai named volume `qris_gateway_data` untuk data permanen. Jangan gunakan
`docker compose down -v` untuk restart karena perintah itu menghapus volume.

SQLite menyimpan invoice, klaim transaksi, audit, API key hash, dan sesi admin.
Sesi/OTP GoBiz serta QRIS statis dienkripsi dengan AES-256-GCM. API key di database
berbentuk hash; password admin memakai scrypt. Cookie admin memakai HttpOnly,
SameSite Strict, dan CSRF untuk perubahan melalui dashboard.

Cadangkan **seluruh** `DATA_DIR`, termasuk `encryption.key`, saat proses berhenti
atau melalui backup SQLite yang konsisten. Jangan menghapus riwayat invoice untuk
mengosongkan nominal unik. Simpan backup dan kunci bersama dengan akses terbatas.
Jalankan satu instance penulis untuk satu direktori data. SQLite bawaan Node 22
dapat menampilkan peringatan experimental saat startup.

## Batas pencocokan QRIS

- Gateway memakai tambahan Rp1–Rp999 dan tidak pernah menggunakan kembali total
  yang sama. Ada maksimal 999 total per rentang harga dasar; rentang antar harga
  bisa bertumpang tindih. Saat habis, pembuatan invoice ditolak. Integrasi ini
  tidak cocok untuk volume tanpa batas karena mutasi tidak membawa ID invoice bank.
- Jendela pembayaran lima menit. Batas ini lokal; QR lama mungkin tetap bisa
  dibayar melalui bank. Pembayaran terlambat perlu rekonsiliasi manual.
- Pemeriksaan dapat dilakukan sampai 24 jam setelah batas waktu untuk pembayaran
  yang sebenarnya terjadi di dalam jendela invoice.
- Hasil ambigu, dua mutasi cocok, atau 100 mutasi ditolak untuk pelunasan otomatis.
  Adapter mengambil maksimal 100 hasil dan belum melakukan pagination lengkap.
- Refund tersimpan pada mutasi, tetapi belum otomatis mengubah invoice lunas atau
  mencabut langganan. Tidak ada auto-debit, pencairan saldo, atau multi-merchant.

## Sumber dan pengujian

Integrasi tidak resmi, mengacu pada
[GoPay Merchant Gateway](https://github.com/ahmadzakiyox/gopay-api-gateaway), commit
`c753b8c23daf5ced58febe650bcd229b6b2b7dec`. Lisensi MIT upstream disertakan di
`LICENSE-UPSTREAM`. Adapter ditulis sebagai kode yang dapat dibaca berdasarkan
kontrak request upstream; file login/session upstream yang obfuscated tidak
disalin atau dijalankan oleh layanan ini. Perubahan API GoBiz mungkin membutuhkan
penyesuaian adapter.

```sh
npm run check
npm test
```

Tes memakai SQLite sementara dan respons GoBiz simulasi, tanpa akun merchant atau
pembayaran nyata. Laporan browser dan pemeriksaan desain ada di [QA.md](QA.md).
Login OTP GoBiz, kecocokan merchant/QRIS, dan pembayaran bank nyata belum diuji;
uji nominal kecil pada akun merchant sebelum menerima pembayaran pengguna.
