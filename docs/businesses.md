# Transaksi bisnis

Menu **Bisnis** tersedia di `/businesses`. Buat bisnis terlebih dahulu, lalu catat pembelian/pengeluaran atau pemasukan penjualan. Setiap catatan mempunyai nominal, keterangan, tanggal, dan pilihan dompet.

Halaman awal menampilkan dashboard arus kas tahunan, diikuti satu kartu buku kas per bisnis. Dashboard membandingkan pemasukan, pengeluaran, dan selisih kas setiap bulan selama Januari–Desember. Kartu buku kas tetap berisi total sepanjang waktu: pemasukan, pengeluaran, selisih, jumlah transaksi, dan hasil terhadap pengeluaran. Klik kartu untuk membuka `/businesses/[businessId]`, tempat detail dan form pencatatan berada. Tautan **Kembali ke semua bisnis** membuka dashboard dan daftar kartu. URL detail dapat dibuka langsung atau di-refresh.

Hasil terhadap pengeluaran dihitung sebagai `(pemasukan - pengeluaran) / pengeluaran × 100%` dari seluruh catatan bisnis. Contoh pembelian Rp100.000 dan penjualan Rp120.000 menghasilkan selisih Rp20.000 dan hasil 20%. Nilai bisa negatif. Jika pengeluaran nol, tampilkan **Belum dapat dihitung**. Nilai ini bukan imbal hasil tahunan atau perhitungan laba persediaan.

- Tanpa dompet: hanya masuk buku transaksi bisnis.
- Dompet pembayaran: saldo berkurang.
- Dompet penerimaan: saldo bertambah.
- Edit transaksi: efek saldo lama dibatalkan, lalu efek baru diterapkan.
- Hapus transaksi: efek saldo dibatalkan.
- Bisnis hanya dapat dihapus setelah seluruh transaksinya dihapus.

Ringkasan menampilkan pemasukan, pengeluaran, dan selisih semua catatan. Selisih merupakan arus pencatatan, bukan perhitungan laba akuntansi dengan persediaan. Buku bisnis disimpan terpisah dari transaksi pribadi. Sinkronisasi dompet mengubah saldo dompet, tanpa membuat salinan transaksi pribadi.

Penyimpanan catatan dan perubahan saldo menggunakan transaksi database dengan isolasi serializable. Bisnis dan dompet harus dimiliki pengguna yang login. Relasi dompet dan bisnis memakai `Restrict` untuk mencegah penghapusan yang meninggalkan catatan terkait. Saat database tidak tersedia, API mengembalikan kegagalan tanpa menyimpan ke memori sementara.

## Dashboard tahunan

- Filter **Tahun** dan **Bisnis** berlaku untuk grafik, ringkasan kas, kontribusi bisnis, dan enam transaksi terbaru, bukan kartu buku kas di bawahnya. **Reset filter** kembali ke tahun berjalan dalam zona waktu akun dan semua bisnis.
- Tahun pilihan berasal dari transaksi pengguna, ditambah tahun berjalan. Pengelompokan bulan, batas tahun, dan waktu transaksi mengikuti zona waktu akun; akun tanpa pengaturan memakai `Asia/Jakarta`.
- Batang penuh menunjukkan pemasukan, batang berarsir menunjukkan pengeluaran, dan garis putus-putus menunjukkan selisih kas. Tooltip menampilkan nominal rupiah; **Lihat angka bulanan** membuka tabel Januari–Desember yang dapat dipakai melalui keyboard dan digeser di dalam panel pada ponsel.
- Ringkasan berisi selisih kas, pemasukan, pengeluaran, margin kas, dan jumlah transaksi sesuai filter. Margin kas adalah `selisih kas / pemasukan × 100%`; tanpa pemasukan, margin tidak tersedia. Ini berbeda dari hasil terhadap pengeluaran pada kartu buku kas.
- Kontribusi bisnis diurutkan berdasarkan pemasukan, menampilkan porsi pemasukan serta selisih kas. Tautan kontribusi dan transaksi terbaru membuka buku kas bisnis terkait.
- Selisih dan margin kas bukan laba akuntansi: persediaan dan HPP belum diperhitungkan. Bulan tanpa transaksi bernilai nol. Kondisi kosong, memuat, gagal, dan **Coba lagi** tersedia tanpa menampilkan angka periode lama sebagai hasil filter baru.

`GET /api/businesses/dashboard` menerima `year` opsional (bilangan bulat 1–9998) dan `businessId` opsional. Tanpa tahun, server memilih tahun berjalan dalam zona waktu akun. Pilihan bisnis dan agregat mencakup seluruh bisnis milik akun, tidak terbatas halaman kartu. Bisnis milik akun lain atau ID tidak ditemukan menghasilkan 404. Hak admin tidak memperluas lingkup data bisnis. Agregasi nominal menggunakan desimal PostgreSQL, rentang tahun berbatas akhir eksklusif, dan snapshot repeatable-read; hanya hasil agregat dan enam transaksi terbaru yang dikirim ke browser.

Verifikasi dashboard memakai database sementara, bukan database akun pengguna:

```sh
DATABASE_URL='postgresql://fintrack@localhost:55432/postgres' npx tsx tests/business-dashboard.integration.ts
```

Tes mencakup batas bulan/tahun dan DST, desimal, margin negatif/tanpa pemasukan, bulan kosong, kesesuaian total dengan kontribusi dan bulan, filter bisnis di luar halaman pertama, urutan transaksi, isolasi akun/admin, filter invalid, autentikasi, dan database tidak tersedia.

## Penerapan

Atur `DATABASE_URL` untuk PostgreSQL aplikasi, kemudian jalankan alur skema yang digunakan proyek:

```sh
npm run db:generate
npm run db:push
```

Mulai ulang backend setelah penerapan. Database utama tidak diubah dalam pengerjaan ini karena `DATABASE_URL` belum tersedia di lingkungan kerja. Skema sudah diterapkan dan diuji pada database sementara lokal.

## Verifikasi

- PASS: `node --import tsx tests/business-summary.regression.ts`, mencakup hasil positif/negatif dan pengeluaran nol.
- PASS: browser dengan API tiruan memeriksa daftar tiga kartu, persentase 20%/-50%/belum dapat dihitung, navigasi kartu melalui keyboard, detail bisnis yang terpisah, URL langsung/refresh, pencatatan transaksi, ringkasan kartu yang diperbarui, dan bisnis tidak ditemukan.
- PASS: daftar kartu pada 360, 768, dan 1280 piksel dalam kedua tema tanpa overflow atau error JavaScript. Struktur kartu seragam agar angka antar bisnis mudah dibandingkan; selisih menjadi fokus tiap kartu, dengan sumber angka seluruhnya dari transaksi bisnis.

- PASS: `npm run typecheck`.
- PASS: `npx tsc -p server/tsconfig.json --noEmit`.
- PASS: validasi Prisma dan penerapan skema pada PostgreSQL sementara.
- PASS: lint file terkait, tanpa error. Sidebar mempunyai peringatan `<img>` yang sudah ada.
- PASS: pengujian integrasi autentikasi, kepemilikan bisnis, nominal/tanggal invalid, pengeluaran, pemasukan, tanpa dompet, mengganti dompet, membatalkan edit gagal, menghapus transaksi, dan pemulihan saldo.
- PASS: browser headless menjalankan create/edit/delete bisnis, create/edit/delete transaksi, pembelian, pemasukan, pilihan tanpa dompet, validasi form kosong, Batal, dan Escape. Tidak ada error JavaScript halaman.
- PASS: screenshot dan pemeriksaan overflow pada 360, 768, dan 1280 piksel dalam tema terang dan gelap.

Tes integrasi hanya boleh memakai database sementara di port 55432:

```sh
DATABASE_URL='postgresql://fintrack@localhost:55432/postgres' npx tsx tests/business.integration.ts
```

Data tes dibersihkan dengan `finally`.

## Antislop Delivery Gate

Lingkup pemeriksaan: halaman bisnis, integrasi navigasi, dan kontrol baru. Shell, komponen bersama, font, serta pengaturan warna merek yang sudah ada dipertahankan. Design Read: Modern Warm Fintech dari `DESIGN.md`, ENERGY 2 / RHYTHM 2 / MOTION 1. Identitas mengikuti ledger FinTrack: nominal tabular, batas panel, hierarki label/nilai, dan aksen utama pada tindakan pencatatan. Warna tombol memakai versi lebih gelap dari warna merek untuk kontras.

- R-01 PASS: tidak ada gradien atau glow baru.
- R-02 PASS: teks baru tidak memakai em dash.
- R-03 PASS: daftar menumpuk di ponsel; screenshot tiga lebar dan pemeriksaan DOM tanpa overflow.
- R-04 PASS: ikon Store menunjuk usaha dan memakai pustaka sidebar yang sudah ada agar konsisten dengan navigasi.
- R-05 PASS: pemilihan bisnis, ringkasan, dan daftar mengikuti kebutuhan pencatatan, tanpa bagian pemasaran.
- R-06 PASS: font aplikasi dipertahankan; nominal memakai tabular numerals untuk perbandingan ledger.
- R-07 PASS: tidak ada pola latar baru.
- R-08 PASS: tidak ada panah dekoratif.
- R-09 PASS: tidak ada badge dekoratif.
- R-10 PASS: memakai modal bersama yang sudah ada; tidak menambahkan permukaan blur.
- R-11 PASS: input/tombol, panel, dan modal memakai hierarki radius komponen aplikasi.
- R-12 PASS: panel ledger tanpa shadow; modal mengikuti elevasi komponen bersama.
- R-13 PASS: tidak ada glow baru.
- R-14 PASS: tiga angka ringkasan berada dalam satu panel, bukan kartu fitur identik.
- R-15 PASS: CTA menyebut tindakan: Buat bisnis, Catat transaksi, Simpan bisnis, Simpan transaksi.
- R-16 PASS: teks baru menjelaskan pencatatan tanpa jargon pemasaran.
- R-17 PASS: seluruh nominal dihitung dari transaksi bisnis yang tersimpan.
- R-18 PASS: tidak ada testimonial.
- R-19 PASS: tidak ada animasi tambahan; transisi shell/modal aplikasi dipakai ulang.
- R-20 PASS: buku bisnis mengikuti ledger dan saldo dompet FinTrack.
- R-21 PASS: mengikuti tema aplikasi; terang dan gelap diverifikasi.
- R-22 PASS: tidak ada ilustrasi tambahan.
- R-23 PASS: fitur dan navigasi bisnis mengikuti permintaan pengguna; tidak ada aset identitas baru.
- R-24 PASS: tautan Bisnis menuju halaman `/businesses` yang dijalankan.
- R-25 PASS: teks fitur dan tombol diuji kontras pada kedua tema; tombol utama digelapkan untuk melewati 4.5:1.
- R-26 PASS: seluruh tombol/form baru memiliki aksi nyata dan diuji melalui browser.
- R-27 PASS: kosong, memuat, gagal, dan coba lagi tersedia; kegagalan API serta retry diuji.
- R-28 PASS: tidak ada FAQ.
- R-29 PASS: memakai netral dan satu warna merek aplikasi.
- R-30 PASS: memakai pola ledger FinTrack yang sudah ada, tanpa meniru produk lain.
- R-31 PASS: panel mengelompokkan satu bisnis; angka mendukung perbandingan; daftar menumpuk agar kontrol muat di ponsel.
- R-32 PASS: label terhubung, kontrol native/Radix, focus ring; Enter/Tab/Escape diuji.
- R-33 PASS: fitur ditulis langsung dalam TSX, tanpa skrip pengubah CSS/source.
- R-34 PASS: screenshot terang/gelap pada tiga ukuran tidak menunjukkan kerusakan layout.
- R-35 PASS: aplikasi dijalankan dan klik-through CRUD, dropdown, validasi, cancel, dan Escape berhasil; tidak ada pageerror.
- R-36 PASS: tidak ada klaim keamanan, kinerja, atau kepatuhan rekaan.
- R-37 PASS: Design Read dan dial dinyatakan sebelum pembuatan UI.
- R-38 PASS: isi layar berasal dari bisnis pengguna; contoh hanya dipakai pada database pengujian.
- Liveliness PASS: ENERGY 2 / RHYTHM 2 / MOTION 1 mengikuti arah proyek; angka bisnis menjadi fokus, whitespace membagi ringkasan dan daftar, aksen pada pencatatan, motif ledger konsisten.
- C-1 PASS: keputusan warna, tipe, ruang, dan susunan mempunyai alasan pencatatan/kontras.
- C-2 PASS: CRUD dan form diuji pada API dan browser.
- C-3 PASS: seluruh bagian melayani pemilihan bisnis atau pencatatan transaksi.
- C-4 PASS: responsif, kedua tema, gagal/retry, validasi, dan keyboard diperiksa.
- C-5 PASS: tidak ada statistik, testimonial, atau klaim rekaan.
