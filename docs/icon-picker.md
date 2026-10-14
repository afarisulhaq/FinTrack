# Pilihan ikon

Pemilih ikon pada dompet, kategori/subkategori, anggaran, tagihan, tabungan, dan wishlist menampilkan pilihan cepat serta tombol **Lihat lainnya**. Tombol ini membuka katalog dari ekspor `icons` pada pustaka yang sudah dipakai aplikasi. Versi terpasang menyediakan 1.544 nama ikon; jumlah dan daftar mengikuti pustaka, tanpa daftar manual tambahan.

Katalog dapat dicari berdasarkan nama, termasuk nama dengan spasi seperti `Shield Check`. Pilihan disimpan memakai nama aslinya, misalnya `ShieldCheck`. Ikon terpilih muncul kembali di pilihan cepat. Hasil kosong menjelaskan cara memperbaiki pencarian. Daftar dapat digulir sementara pencarian tetap terlihat.

Dialog katalog berada di atas form asal. Memilih ikon atau menekan Escape menutup katalog dan mempertahankan form asal.

## Verifikasi antislop

Arah `DESIGN.md` tetap ENERGY 2 / RHYTHM 2 / MOTION 1. Ikon memakai pustaka yang sudah tersedia sesuai permintaan pengguna; grid digunakan untuk membandingkan pilihan.

- Hard Gate PASS: browser dengan API tiruan memverifikasi seluruh 1.544 pilihan, pencarian, hasil kosong, pemilihan dengan Enter, Escape bertingkat, penyimpanan `ShieldCheck` pada request dompet, keenam form, dan layar 360/768/1280 piksel dalam dua tema tanpa overflow horizontal atau error JavaScript. Tombol pilihan memiliki nama aksesibilitas, status terpilih, focus ring, dan area klik minimal 44 piksel.
- Purpose-Gate PASS: ikon menjadi pilihan data pengguna; tombol Lihat lainnya membuka katalog; grid dan pencarian membantu pengguna menemukan pilihan tanpa menulis nama ikon secara manual.
- Liveliness PASS: pilihan cepat dan ikon terpilih menjadi fokus form; warna, jarak, dan hierarki mengikuti komponen aplikasi yang ada.
- Craftsmanship PASS: daftar berasal dari pustaka asli, pilihan diteruskan ke form asal, dan dialog bertingkat diuji dengan mouse serta keyboard.
