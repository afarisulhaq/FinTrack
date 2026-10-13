# Penyimpanan watchlist per akun

`/market-watch` membaca watchlist dari `/api/market-watchlist/`. Database menyimpan simbol per ID pengguna dalam tabel `MarketWatchlist`. Harga pasar tetap diambil melalui API quote.

Saat akun belum memiliki watchlist, halaman mengimpor daftar browser lama sekali. Daftar kosong di database tetap kosong dan tidak diganti daftar awal. Data browser lama baru dihapus setelah impor ke database berhasil.

Tambah/hapus menggunakan operasi per simbol. Transaksi database mengunci watchlist agar perubahan dari perangkat berbeda tidak menimpa seluruh daftar. Database terkonfigurasi yang gagal diakses mengembalikan 503 tanpa beralih ke data sementara.

Konfigurasi `DATABASE_URL` untuk PostgreSQL, kemudian jalankan:

```sh
npx prisma db execute --file prisma/patches/20261013-market-watchlist.sql --schema prisma/schema.prisma
npx prisma generate
```

Tanpa `DATABASE_URL`, backend memakai daftar sementara per akun dan halaman menampilkan bahwa data tidak bertahan setelah restart backend. Mode ini belum merupakan penyimpanan database permanen.

Validasi:

```sh
node --import tsx tests/market-watchlist.integration.ts
npm run typecheck
npx tsc -p server/tsconfig.json --noEmit
```

Tes integrasi memeriksa autentikasi, isolasi akun, impor sekali, daftar kosong, penambahan paralel, validasi simbol, dan respons saat PostgreSQL tidak tersedia. Penyimpanan PostgreSQL aktual serta migrasi melalui browser belum diuji.
