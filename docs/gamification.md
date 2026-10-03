# Gamifikasi dan navigasi menu

Gamifikasi dihitung dari catatan pengguna dalam finance store. Skor, nama, avatar, dan peringkat pengguna contoh sudah dihapus. Nilai XP/lencana lama yang ditulis manual ke `GamificationState` tidak digunakan untuk tampilan ini.

Setiap transaksi valid bernominal positif menghasilkan 5 XP. Transaksi dengan tanggal tidak valid atau hari pencatatan di masa depan tidak dihitung. Lencana memberi bonus sekali per syarat yang terpenuhi:

| Lencana | Syarat | Bonus XP |
| --- | --- | --- |
| Catatan pertama | 1 transaksi | 20 |
| Sepuluh catatan | 10 transaksi | 50 |
| Lima puluh catatan | 50 transaksi | 100 |
| Tiga hari konsisten | Streak terpanjang 3 hari | 50 |
| Seminggu konsisten | Streak terpanjang 7 hari | 100 |
| Target tabungan tercapai | 1 target positif yang tercapai | 100 |
| Tagihan dibayar | 1 tagihan berstatus paid | 30 |
| Utang atau piutang selesai | 1 catatan selesai | 50 |

Level mulai pada 0, 100, 300, 600, dan 1.000 XP. Peringkat merupakan level pencatatan pribadi, bukan leaderboard antar pengguna atau skor kesehatan finansial. Syarat dan aturan XP terlihat di halaman serta detail lencana.

Streak dan kalender mengikuti zona waktu profil, default Asia/Jakarta. Streak saat ini berakhir hari ini atau kemarin; streak terpanjang dihitung dari hari-hari berturut-turut yang mempunyai catatan. Hari tanpa catatan tidak ditafsirkan sebagai hari tanpa pengeluaran. Transaksi yang dihitung berasal dari buku transaksi pribadi; buku bisnis terpisah.

Progres dihitung ulang dari data yang masih tersimpan. Menghapus transaksi atau mengubah status target/tagihan/utang dapat menurunkan progres dan XP. Tanggal perolehan lencana tidak ditampilkan karena belum ada riwayat pencapaian yang dapat memverifikasinya.

## Navigasi

Layout sebelumnya mengambil bootstrap pada setiap perubahan pathname dan membungkus halaman dalam animasi keluar/masuk dengan key pathname. Pengambilan ulang dan transisi ini membuat pergantian menu terasa seperti refresh. Keduanya dihapus dari alur perpindahan menu; sidebar tetap memakai Next Link.

Bootstrap tetap dijalankan saat awal sesi dan ketika tab kembali aktif. Guard mencegah bootstrap berjalan bersamaan. Penyimpanan resource tetap mempertahankan sinkronisasi yang sudah ada. Kegagalan bootstrap ditampilkan pada Gamifikasi dan bisa dicoba ulang.

## Verifikasi dan antislop

- PASS: `node --import tsx tests/gamification.regression.ts`, mencakup data kosong, XP nyata, batas tanggal Jakarta, streak, syarat lencana, target/tagihan/utang, level, tanggal invalid/masa depan, dan penghitungan ulang.
- PASS: TypeScript dan lint file terkait.
- PASS: browser dengan API tiruan mengabaikan nilai dummy 9.999 XP; 10 transaksi valid menghasilkan 120 XP dan 2 dari 8 lencana; modal lencana dan Escape berfungsi.
- PASS: pindah Dompet → Gamifikasi → Dompet → Gamifikasi mempertahankan dokumen yang sama dan tidak menambah permintaan bootstrap. Focus memicu sinkronisasi; kegagalan bootstrap dan Coba lagi diuji.
- PASS: screenshot 360, 768, dan 1.280 piksel pada kedua tema, tanpa overflow horizontal atau error JavaScript.
- Hard Gate PASS: tidak ada nama/peringkat/skor pengguna rekaan; angka berasal dari catatan; loading, kosong, gagal/retry tersedia; tombol lencana dan modal diuji; kontrol focus dan keyboard memakai elemen native/Radix.
- Purpose-Gate PASS: ikon mewakili jenis pencapaian, konsisten dengan pustaka aplikasi; tidak ada glow/gradien/animasi baru. Kartu lencana seragam agar status dan syarat dapat dibandingkan.
- Liveliness PASS: mengikuti DESIGN.md, ENERGY 2 / RHYTHM 2 / MOTION 1; ringkasan level/XP menjadi fokus, lalu kalender, lencana, dan level pribadi. Aksen merek dipakai pada progres.
- Craftsmanship PASS: sumber data nyata dan satu fungsi penghitungan, kalender mengikuti zona waktu, angka tidak menilai kesehatan finansial, layout menumpuk di ponsel, hasil diperiksa melalui regression test dan browser.

Tidak ada perubahan skema database. Terapkan dengan rebuild Docker:

```sh
docker compose --env-file .env.production up -d --build
```
