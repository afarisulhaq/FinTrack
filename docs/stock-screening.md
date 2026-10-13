# Kandidat Pantauan

Panel `/market-watch` menggantikan rekomendasi lama berdasarkan rentang 52 minggu dengan penyaringan riwayat OHLCV harian enam bulan untuk 20 simbol BEI yang ditentukan di `server/routes/stock-screening.ts`. Hasil merupakan daftar pantauan teknikal, bukan identifikasi aktivitas broker tertentu atau probabilitas keuntungan.

Riwayat menggunakan `fetchYahooChart`, sehingga konfigurasi `YAHOO_PROXY_URL` yang sudah ada otomatis digunakan. Worker `infra/worker/yahoo-proxy.js` sudah meneruskan endpoint chart dan parameter `range=6mo`; tidak perlu mengubah atau deploy ulang worker untuk fitur ini. Browser hanya menghubungi backend FinTrack.

## Aturan

- Breakout: penutupan melewati high 20 sesi sebelumnya dan volume minimal 1,5 kali rata-rata 20 sesi sebelumnya.
- Indikasi akumulasi: CMF20 > 0,1, perubahan OBV lima sesi positif, rata-rata volume lima sesi minimal 1,2 kali 20 sesi sebelumnya, rentang harga 20 sesi sebelumnya maksimal 15%.
- Dekat MA20: harga di atas MA20 dan maksimal 3% di atasnya, MA20 > MA50, RSI14 antara 45 dan 70. RSI memakai rerata sederhana, bukan smoothing Wilder.
- Likuiditas: estimasi nilai transaksi rata-rata (close × volume) minimal Rp1 miliar/hari. Data lebih dari tujuh hari atau lonjakan close > 25% tidak menghasilkan kandidat.
- Risiko: volatilitas ATR14 > 5%, RSI > 70, tekanan jual CMF/OBV, likuiditas rendah, dan potensi aksi korporasi.

Support/resistance memakai low/high 20 sesi sebelum sesi terakhir. Level peninjauan ulang adalah resistance untuk breakout atau support untuk skenario lain. Level tersebut tidak merupakan jaminan harga eksekusi.

OHLCV yang kosong/tidak valid dibuang. Analisis memerlukan minimal 51 sesi valid. Sesi hari ini sebelum 16.30 WIB dikeluarkan agar volume parsial tidak dibandingkan dengan sesi lengkap. Data menggunakan harga mentah; lonjakan dan aksi korporasi harus diperiksa pengguna.

## Operasional

Endpoint `/api/stock-screening` membutuhkan autentikasi. Maksimal tiga permintaan Yahoo berjalan bersamaan. Pemindaian dibatasi 45 detik. Permintaan bersamaan memakai hasil proses yang sama. Cache hasil 15 menit, cache kegagalan 30 detik; Yahoo 429 menghentikan permintaan berikutnya. Kegagalan parsial dan tanggal sesi ditampilkan. Tidak ada data contoh atau harga rekayasa sebagai pengganti sinyal.

Daftar kandidat belum dipersonalisasi berdasarkan profil risiko dan belum mencakup seluruh saham BEI. Data broker summary tidak disediakan oleh proxy ini.

## Validasi

```sh
node --import tsx tests/stock-screening.regression.ts
node --import tsx tests/stock-screening.integration.ts
node --import tsx tests/stock-screening-outage.regression.ts
npm run build
npx tsc -p server/tsconfig.json --noEmit
```

Tes API memakai respons Yahoo tiruan; perhitungan memakai seri OHLCV terkontrol. Proxy Cloudflare produksi dan tampilan browser belum diuji langsung. Konfigurasi lokal saat implementasi belum memiliki `YAHOO_PROXY_URL`.

Referensi dasar indikator: [OBV](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/OBV) dan [Accumulation/Distribution](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/accumulation-distribution). Ambang penyaringan merupakan aturan aplikasi, tidak diklaim sebagai hasil backtest.
