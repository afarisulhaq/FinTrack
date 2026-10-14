# Dompet RDN untuk investasi

Buat dompet dengan jenis **RDN**, lalu buat kantong **Ajaib** dan **Stockbit** melalui menu Dompet. Kantong memakai ID dompet masing-masing; saldo induk tidak dipotong lagi saat kantong dipakai.

Pada Tambah Aset, pilih **Dompet sumber dana**. Nilai beli dan fee mengurangi saldo dompet itu. Saham dihitung dalam lembar: input 1 lot menjadi 100 lembar sebelum nilai beli dihitung. Posisi dengan broker, simbol, kelas aset, dan dompet sumber yang sama digabung; dompet berbeda menghasilkan posisi terpisah. Relasi sumber dana ditampilkan di bawah simbol aset.

Saat Jual, **Dompet penerima hasil jual** awalnya mengikuti sumber dana investasi. Pilihan ini dapat diganti, termasuk ke kantong lain. Nilai jual dikurangi fee lalu ditambahkan ke saldo penerima. Pilihan **Tanpa dompet** tetap tersedia untuk pencatatan portofolio tanpa perubahan saldo.

Edit jumlah, harga beli, fee, atau dompet sumber menyesuaikan dana beli yang tercatat. Dompet sumber tidak bisa diganti setelah penjualan. Pembatalan jual membalikkan seluruh penjualan yang tercatat pada posisi tersebut, sesuai perilaku pembatalan sebelumnya. Hapus investasi membalikkan perubahan saldo yang tercatat. Harga pasar tidak mengubah saldo dompet. Posisi lama tidak otomatis dipotong dari saldo, dan restore tidak mengulang pembelian.

Perubahan investasi dan saldo disimpan dalam satu transaksi database. Penjualan dan perubahan posisi mengunci baris investasi; pembelian berulang juga dikunci berdasarkan identitas posisi. Pengguna biasa hanya bisa memakai dompetnya sendiri; akses admin mengikuti dompet yang dapat dilihatnya.

## Penerapan

Skema menambahkan `Investment.walletId` dan `Investment.walletEffects`. Untuk deployment Docker yang menjalankan sinkronisasi Prisma saat startup, rebuild container akan menerapkan kolom tersebut. Jika sinkronisasi dinonaktifkan, jalankan patch [20261014-investment-wallets.sql](../prisma/patches/20261014-investment-wallets.sql) sebelum menjalankan backend baru. Patch hanya menambah dua kolom dan tidak mengubah catatan lama.

## Verifikasi

- `node --import tsx tests/investment-wallets.regression.ts`: beli, tambah posisi, kantong berbeda, fee, jual sebagian/penuh, penerima berbeda, pembatalan, koreksi, hapus, kepemilikan, nominal tidak valid, rollback, admin, portofolio tanpa dompet, dan restore. Pengujian memakai Prisma tiruan.
- Pemeriksaan TypeScript aplikasi dan backend lulus.
- `node --import tsx tests/investment-store.regression.ts`: merge fee, posisi dengan dompet berbeda, posisi tertutup, dan pemulihan pembelian yang gagal.
- Browser dengan API tiruan: pilihan RDN bertingkat, sumber tersimpan menjadi pilihan awal penerima hasil jual, request jual memakai pilihan penerima, tombol ikon bisnis membuka dialog yang sesuai, serta layar 360/768/1280 piksel dalam tema terang dan gelap tanpa overflow horizontal atau error JavaScript.

## Antislop

Arah desain: `DESIGN.md`, ENERGY 2 / RHYTHM 2 / MOTION 1. Perubahan memakai komponen pemilih dompet, warna, dan pola kontrol yang sudah ada.

- Hard Gate PASS untuk kontrol yang diubah: pemilih dana dan tombol bisnis bekerja; ikon memiliki nama aksesibilitas, tooltip, focus ring, serta area klik 44 piksel. Kontras teks sekunder terhadap permukaan adalah 9,29:1 dalam tema terang dan 6,93:1 dalam tema gelap. Ukuran layar dan kedua tema diperiksa lewat browser.
- Purpose-Gate PASS: ikon pensil dan tempat sampah menunjukkan edit/hapus; teks dana menjelaskan akibat pilihan terhadap saldo. Tidak menambah efek dekoratif.
- Liveliness PASS: hierarki ringkasan dan daftar bisnis tetap menjadi fokus, mengikuti pola ledger dan aksen yang ada.
- Craftsmanship PASS: transaksi saldo diuji termasuk rollback; bisnis memakai ikon yang konsisten tanpa mengubah alur konfirmasi hapus.
