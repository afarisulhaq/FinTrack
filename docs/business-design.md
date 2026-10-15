# Buku usaha

Detail bisnis ditata sebagai buku kas: identitas usaha, selisih dari semua transaksi, rincian pemasukan/pengeluaran, indikator pengeluaran tertutup, lalu riwayat transaksi. Selisih menjadi angka utama agar hasil pencatatan langsung terlihat. Panel tindakan memisahkan Catat penjualan dan Catat pengeluaran, dengan jenis form yang langsung sesuai.

Indikator dihitung dari pemasukan dibagi pengeluaran, dibatasi 100% karena mengukur bagian pengeluaran yang sudah tertutup. Tanpa pengeluaran, indikator menjelaskan bahwa pembanding belum tersedia. Pesan ringkasan mengikuti kondisi kosong, surplus, minus, atau seimbang. Tidak memakai target, tren, streak, maupun pencapaian yang tidak tersedia dalam data.

Daftar transaksi menampilkan arah uang, tanggal, dompet, nominal, serta ikon edit/hapus yang selalu terlihat. Filter jenis dan pencarian keterangan berjalan di backend bersama pagination. Ringkasan usaha tetap menghitung semua transaksi ketika daftar difilter. Kartu pada daftar bisnis memakai nama, selisih berwarna sesuai kondisi, dan tautan Buka buku kas.

## Dashboard daftar bisnis

Halaman `/businesses` memakai grafik Januari sampai Desember sebagai fokus, dengan ringkasan kas di sampingnya pada layar lebar dan di bawahnya pada ponsel. Daftar kontribusi menjawab bisnis mana yang menyumbang pemasukan; transaksi terbaru menyediakan jalan kembali ke pencatatan. Kartu buku kas sepanjang waktu tetap terpisah dari filter tahunan.

- Warna hijau/merah menunjukkan arah kas; nominal memakai varian teks yang lebih gelap pada tema terang. Selector `.dark` aplikasi, bukan preferensi sistem, menentukan varian tema agar warna tetap terbaca ketika keduanya berbeda.
- Batang penuh/arsir dan garis putus-putus membedakan seri selain melalui warna. Tooltip dan tabel bulanan menyediakan nominal rinci tanpa bergantung pada pembacaan tinggi batang.
- Font aplikasi dan angka tabular dipertahankan untuk membandingkan catatan kas. Panel grafik lebih besar daripada ringkasan; daftar kontribusi dan transaksi memakai pemisah, bukan tambahan kartu dekoratif.
- Spasi memisahkan analisis tahunan dari buku kas. Aksen merek menandai garis selisih; tidak ada glow, gradien, ilustrasi, ikon dekoratif, atau animasi grafik tambahan.

### Verifikasi dashboard

- PASS: `npm run typecheck`, `npx tsc -p server/tsconfig.json --noEmit`, dan ESLint pada file fitur terkait.
- PASS: integrasi dashboard pada PostgreSQL sementara, regresi filter/ringkasan, dan integrasi transaksi bisnis yang sudah ada.
- PASS: browser memakai API dan PostgreSQL nyata dengan akun berlabel data uji. Filter 2025/2026 dan bisnis memperbarui nominal, margin, kontribusi, dan transaksi; bisnis tanpa transaksi menunjukkan kondisi kosong; Reset filter kembali ke semua bisnis dan tahun berjalan.
- PASS: respons tahun lama yang sengaja ditunda tidak menggantikan hasil filter terbaru. Injeksi kegagalan API menampilkan kondisi memuat lalu pesan gagal; Coba lagi kembali memuat data backend nyata.
- PASS: tautan kontribusi membuka buku kas, menyimpan penjualan tambahan memperbarui selisih dashboard, dan tautan transaksi terbaru membuka bisnis yang sesuai.
- PASS: Enter membuka/menutup tabel bulanan; tombol panah mengubah filter tahun; tabel dapat digeser di dalam panel pada 360 piksel tanpa memperlebar halaman.
- PASS: pemeriksaan DOM pada 360, 768, dan 1440 piksel dalam kedua tema tidak menemukan overflow dashboard, target kontrol baru di bawah 44 piksel, atau teks dashboard di bawah kontras 4,5:1. Kontras teks pemasukan/pengeluaran pada panel ringkasan terang adalah 6,15:1 dan 5,53:1. Seri grafik terhadap permukaan terang paling rendah 3,19:1.
- PASS: screenshot desktop dan ponsel diperiksa; tidak ada exception JavaScript halaman. Pembatalan request daftar ketika berpindah halaman dan kegagalan API terkontrol termasuk skenario verifikasi.

### Delivery Gate dashboard

- Hard Gate PASS (R-02, R-03, R-17, R-18, R-23 sampai R-28, R-32 sampai R-38): data nyata, keadaan kosong/memuat/gagal, filter dan navigasi aktif, keyboard, kontras, serta kedua tema diperiksa pada browser yang berjalan. Tidak menambah aset identitas, klaim, statistik rekaan, FAQ, atau navigasi baru.
- Purpose-Gate PASS (R-01, R-04, R-06 sampai R-10, R-12 sampai R-14, R-19, R-22): alasan warna, bentuk seri, tipe, ruang, dan panel dijelaskan di atas; tidak ada dekorasi tanpa fungsi atau animasi berulang.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 sesuai `DESIGN.md`; grafik menjadi fokus, ringkasan dan daftar membentuk ritme analisis, dan motif ledger dipertahankan melalui nominal tabular serta pemisah.
- Craftsmanship PASS (C-1 sampai C-5; R-05, R-11, R-15, R-16, R-20, R-21, R-29 sampai R-31): bagian dashboard memiliki pertanyaan kas yang jelas, kontrol diuji, data berasal dari transaksi, pola radius/tema aplikasi dipakai ulang, dan keputusan visual memiliki alasan yang tertulis.

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
