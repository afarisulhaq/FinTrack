# Saldo dompet dan kantong

Saldo tersimpan pada setiap dompet merupakan saldo dompet itu sendiri. Saldo kelompok yang ditampilkan pada kartu induk adalah saldo utama ditambah saldo seluruh kantongnya. Total keseluruhan menjumlahkan setiap ID dompet tepat satu kali, termasuk bila data memiliki bentuk campuran flat dan nested.

Contoh: saldo utama Rp200.000 dan kantong Rp100.000 menghasilkan saldo kelompok Rp300.000. Jika ada dompet lain Rp300.000, total keseluruhan Rp600.000. Saat kantong diedit menjadi Rp150.000, saldo kelompok menjadi Rp350.000 dan total keseluruhan Rp650.000. Kolom edit induk tetap mengubah saldo utamanya saja.

Normalisasi hierarki dipakai saat penambahan, edit, penghapusan, refresh, dan bootstrap. Respons edit memperbarui satu dompet, tanpa fetch tambahan yang mengganti semua dompet. Penyimpanan gagal memulihkan catatan semula. Dompet dengan induk hilang atau hubungan siklik tetap ditampilkan sebagai dompet utama agar data tidak hilang dari daftar. Backend juga menyusun respons daftar tanpa membuang dompet tersebut.

## Verifikasi

- PASS: `node --import tsx tests/wallets.regression.ts`, mencakup total nested/flat tanpa duplikasi, saldo kelompok, edit kantong, pindah/lepas induk, orphan/siklus, respons simpan, rollback, bootstrap, dan rollback penghapusan kantong.
- PASS: TypeScript aplikasi dan backend; lint file terkait tanpa error.
- PASS: browser dengan API tiruan, edit kantong Rp100 menjadi Rp150 langsung menampilkan saldo induk Rp350 dan total Rp650; tidak ada keadaan kosong atau fetch daftar tambahan.
- PASS: respons simpan gagal mengembalikan saldo Rp650; dashboard menampilkan total yang sama.
- PASS: browser pada 360, 768, dan 1280 piksel dalam tema terang/gelap tanpa overflow horizontal atau error JavaScript.
- PASS: `git diff --check`.

## Antislop Delivery Gate

Lingkup: perubahan saldo, teks penjelasan, dan kontrol edit/hapus dompet. Arah `DESIGN.md` tetap ENERGY 2 / RHYTHM 2 / MOTION 1. Komponen, tema, dan ikon dompet yang sudah ada dipakai ulang.

- Hard Gate PASS: nominal berasal dari state dompet; tidak ada klaim/aset baru; edit dan rollback diuji; layout diperiksa pada tiga ukuran dan dua tema; kontrol edit/hapus selalu terlihat, mempunyai focus ring, dan area 44 piksel.
- Purpose-Gate PASS: tidak menambah efek visual; teks saldo utama menjelaskan perbedaan saldo tersimpan dan saldo kelompok, sehingga edit tidak menjumlahkan kantong dua kali.
- Liveliness PASS: total saldo menjadi fokus; hierarki nominal/label, motif ledger, aksen merek, dan jarak panel yang sudah ada dipertahankan.
- Craftsmanship PASS: Dompet, distribusi saldo, dan dashboard memakai sumber perhitungan yang sama; state gagal dipulihkan; regression test dan browser memverifikasi perilaku akhir.

## Docker

Tidak ada perubahan skema database untuk perbaikan dompet ini. Terapkan dengan rebuild container:

```sh
docker compose --env-file .env.production up -d --build
```
