# Buku usaha

Detail bisnis ditata sebagai buku kas: identitas usaha, selisih dari semua transaksi, rincian pemasukan/pengeluaran, indikator pengeluaran tertutup, lalu riwayat transaksi. Selisih menjadi angka utama agar hasil pencatatan langsung terlihat. Panel tindakan memisahkan Catat penjualan dan Catat pengeluaran, dengan jenis form yang langsung sesuai.

Indikator dihitung dari pemasukan dibagi pengeluaran, dibatasi 100% karena mengukur bagian pengeluaran yang sudah tertutup. Tanpa pengeluaran, indikator menjelaskan bahwa pembanding belum tersedia. Pesan ringkasan mengikuti kondisi kosong, surplus, minus, atau seimbang. Tidak memakai target, tren, streak, maupun pencapaian yang tidak tersedia dalam data.

Daftar transaksi menampilkan arah uang, tanggal, dompet, nominal, serta ikon edit/hapus yang selalu terlihat. Filter jenis dan pencarian keterangan berjalan di backend bersama pagination. Ringkasan usaha tetap menghitung semua transaksi ketika daftar difilter. Kartu pada daftar bisnis memakai nama, selisih berwarna sesuai kondisi, dan tautan Buka buku kas.

## Verifikasi

- `node --import tsx tests/business-filters.regression.ts`: filter jenis, pencarian tanpa membedakan kapital, hasil kosong, ringkasan seluruh usaha, jenis tidak valid, dan isolasi pemilik. Memakai Prisma tiruan.
- `node --import tsx tests/business-summary.regression.ts`: perhitungan pemasukan, pengeluaran, selisih, persentase, serta kondisi tanpa pengeluaran.
- Browser dengan API tiruan: tambah/edit/hapus transaksi, tombol langsung mengisi jenis pemasukan/pengeluaran, edit identitas bisnis, filter dan pencarian/reset, kembali ke daftar, kondisi kosong/minus/seimbang/surplus, serta indikator 0/50/100%.
- Tampilan diperiksa pada 360, 768, dan 1440 piksel dalam tema terang/gelap. Tidak ada overflow horizontal atau error JavaScript. Screenshot menggunakan bisnis yang dilabeli **data uji**, bukan data akun pengguna.

## Antislop Delivery Gate

Design Read: Modern Warm Fintech dari `DESIGN.md`, ENERGY 2 / RHYTHM 2 / MOTION 1. Motif buku kas diwujudkan lewat hierarki nominal, garis pemisah, dan baris transaksi; panel hasil dan panel tindakan memakai proporsi berbeda. Aksen merek difokuskan ke tindakan mencatat; hijau/merah menunjukkan arah dan kondisi uang.

- Hard Gate PASS: seluruh indikator berasal dari data transaksi; form, filter, pencarian, reset, edit/hapus, dan navigasi diuji di browser. Kontrol baru memiliki label, focus ring, dan area klik minimal 44 piksel. Kontras nominal pemasukan 5,02:1 pada tema terang dan 10,09:1 pada tema gelap; tombol utama 12,71:1 pada warna merek yang diuji; indikator parsial 4,33:1 terhadap track terang, melewati batas 3:1 untuk informasi nonteks. Layout kedua tema diperiksa pada tiga ukuran.
- Purpose-Gate PASS: ikon toko menunjukkan konteks usaha, panah menunjukkan arah uang, dan buku menandai riwayat pencatatan. Progress mengukur pengeluaran yang tertutup, bukan dekorasi. Tidak menambah gradient, glow, ilustrasi, atau animasi berulang.
- Liveliness PASS: selisih usaha menjadi fokus; susunan hasil, tindakan, dan buku kas membentuk ritme yang berbeda. Tombol merek menjadi aksen; pemisah dan angka tabular mempertahankan identitas ledger.
- Craftsmanship PASS: kondisi kosong, minus, dan pembanding nol memiliki pesan yang sesuai; filter tidak mengubah total seluruh usaha; alur CRUD, keyboard form, respons mobile, dan warna yang benar-benar dirender dalam kedua tema diperiksa.
