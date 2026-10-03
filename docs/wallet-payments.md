# Pembayaran yang terhubung ke dompet

- Tagihan: pilih dompet saat mencatat pembayaran. Pembayaran mengurangi saldo.
- Tabungan: pilih dompet sumber dan tujuan. Dana berpindah dengan nominal yang
  sama, sementara total saldo seluruh dompet tetap.
- Utang: pinjaman yang diterima menambah saldo; cicilan mengurangi saldo.
  Piutang memakai arah sebaliknya. Setiap cicilan menyimpan dompetnya sendiri.
- Patungan: pembayaran awal mengurangi saldo dompet sumber. Konfirmasi
  penerimaan peserta menambah saldo dompet penerima. Klaim pembayaran melalui
  link publik belum menambah saldo; pemilik mencatat penerimaan ke dompet.

Perubahan pembayaran menerapkan selisih terhadap efek sebelumnya. Menghapus
catatan membalik perubahan saldo yang terhubung, setelah pengguna mengonfirmasi.
Pembayaran ulang dengan data yang sama tidak menggandakan perubahan saldo.
Kontribusi tabungan menggunakan ID permintaan untuk mencegah setoran ganda.

Catatan lama tanpa dompet tetap terbaca dan tidak otomatis mengubah saldo.
Tagihan lama yang sudah lunas dapat dicatat ke dompet lewat tombol pembayaran.
Cicilan lama dapat dihubungkan saat diedit. Saldo awal yang telah dicatat manual
perlu diperiksa sebelum menghubungkan pembayaran lama agar tidak dihitung dua kali.

Dalam mode database, saldo dan catatan disimpan dalam satu transaksi PostgreSQL.
Baris catatan dikunci saat diperbarui untuk mencegah pembayaran ganda. Saat
database terkonfigurasi tetapi terputus, operasi gagal; data cadangan tidak dipakai.
Mode pengembangan tanpa database mendukung alur yang sama dalam memori,
tetapi data tidak bertahan setelah backend dimulai ulang.

Untuk database yang sudah ada, terapkan patch sebelum menjalankan versi ini:

```sh
npx prisma db execute --file prisma/patches/20261004-feature-wallet-payments.sql --schema prisma/schema.prisma
npx prisma generate
```

Tes API dan regresi:

```sh
node --import tsx tests/wallet-payments.integration.ts
node --import tsx tests/wallet-effects.regression.ts
node --import tsx tests/debt-installments.regression.ts
```

Tes API memeriksa pembayaran, perubahan, pembalikan, dan pembayaran ulang dalam
mode pengembangan. Tes layanan memeriksa pembatasan dompet pemilik, transaksi
gagal, klaim publik, konfirmasi pemilik, dan pembatalan penerimaan dengan klien
database tiruan. PostgreSQL aktual dan tampilan browser belum diuji di sesi ini.
