# Kategori bawaan setiap akun

Daftar pengguna disimpan di `src/lib/default-categories.ts`: 14 kategori pengeluaran, 5 kategori pemasukan, dan 107 subkategori. Nama, ikon, warna, slug, serta warna latar pada template mengikuti daftar yang diberikan. Model kategori saat ini menyimpan nama, ikon, dan warna; slug serta warna latar tetap tersimpan pada template.

Registrasi dan pembuatan akun oleh admin mengisi kategori dalam transaksi database yang sama dengan pembuatan akun. Akun lama diisi saat menjalankan seed atau saat pertama kali memuat bootstrap/lookups. Semua peran mendapat salinan dengan `userId` masing-masing. Lookup form memakai kategori akun yang sedang login, termasuk untuk admin, sehingga tidak menampilkan salinan default milik seluruh akun sekaligus.

Kategori dengan jenis dan nama yang sama dipakai kembali tanpa mengganti ID, ikon, warna, atau urutan yang sudah disunting. Subkategori yang cocok juga tidak ditimpa. Kategori kustom, transaksi, dan relasi yang sudah ada dipertahankan. Kategori lama dengan nama berbeda tetap tersedia bersama default baru.

`User.categoryDefaultsVersion` menandai pengisian yang sudah selesai. Login atau seed ulang tidak menggandakan data, menimpa suntingan, atau mengembalikan default yang sengaja dihapus. Pengisian mengunci baris akun; jika gagal, seluruh perubahan dan penanda versi dibatalkan agar dapat dicoba kembali.

## Penerapan

Tambahkan kolom lewat sinkronisasi Prisma yang dipakai deployment, atau jalankan `prisma/patches/20261014-default-categories.sql`. Lalu isi semua akun lama menggunakan:

```sh
npm run db:seed-categories
```

Perintah tersebut hanya mengisi kategori default. Deployment Docker dengan sinkronisasi dan seed pada startup akan memeriksa semua akun ketika container dibangun dan dijalankan ulang. Tidak ada perintah perubahan database yang dijalankan terhadap data asli selama implementasi ini.

## Verifikasi

`node --import tsx tests/default-categories.regression.ts` memakai Prisma tiruan untuk memverifikasi jumlah dan ikon dari daftar, seluruh peran akun, pengisian berulang/concurrent, data kustom, default yang dihapus, rollback dan retry, registrasi, akun yang dibuat admin, backfill bootstrap akun lama, lookup milik akun sendiri, serta mode tanpa database.
