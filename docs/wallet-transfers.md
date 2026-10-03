# Transfer antar dompet

Transfer menyimpan dompet asal dan tujuan pada satu transaksi. Saldo asal
berkurang dan saldo tujuan bertambah dengan nominal yang sama. Transfer tidak
menambah total pemasukan atau pengeluaran. Kedua dompet harus tersedia bagi
pengguna, berbeda, dan memakai mata uang yang sama.

Penyimpanan, perubahan, dan penghapusan transaksi memperbarui saldo dalam satu
transaksi database. Transfer lama tanpa tujuan tetap terbaca; pilih tujuan saat
mengeditnya. Saat database tidak tersedia, transfer baru ditolak.

Sebelum menjalankan versi ini pada database yang sudah ada, tambahkan dua kolom
nullable. Patch ini tidak menghapus data:

```sh
npx prisma db execute --file prisma/patches/20261003-wallet-transfers.sql --schema prisma/schema.prisma
npx prisma generate
```

Perintah tersebut memerlukan `DATABASE_URL` pada environment. Pada database
baru, gunakan alur pembuatan skema proyek seperti biasa.

Verifikasi otomatis:

```sh
node --import tsx tests/transfers.regression.ts
node --import tsx tests/wallets.regression.ts
```

Tes transfer menggunakan database tiruan untuk memeriksa buat, edit, hapus,
validasi kepemilikan, tujuan berbeda, dan rollback saat pembaruan tujuan gagal.
Pemeriksaan browser dan integrasi PostgreSQL aktual masih perlu dilakukan.
