# fintrack-yahoo-proxy

Cloudflare Worker yang meneruskan request Yahoo Finance lewat IP
Cloudflare — Yahoo tidak rate-limit Cloudflare seagresif VPS
datacenter (AWS, DO, Hetzner, dll).

## Deploy

```bash
cd infra/worker
npm install -g wrangler
wrangler login
wrangler deploy
```

Wrangler akan print URL seperti:

```
Published fintrack-yahoo-proxy
  https://fintrack-yahoo-proxy.<your-subdomain>.workers.dev
```

## Konfigurasi FinTrack server

Tambah ke `.env.production` (atau `.env` di dev):

```
YAHOO_PROXY_URL=https://fintrack-yahoo-proxy.<your-subdomain>.workers.dev
```

Restart container. `server/services/market-price.ts` akan otomatis
prefix semua URL chart & search ke proxy.

Kalau `YAHOO_PROXY_URL` kosong, server fallback ke direct Yahoo
(query1/query2) seperti sebelumnya.

## Cara kerja

- **Path-based**, bukan open proxy. Worker hanya forward path yang
  cocok `/^\/v\d+\/finance\//`. Apapun lain (mis. `/wp-admin`)
  return 400.
- **Multi-host fallback**: `query2.finance.yahoo.com` dulu, lalu
  `query1.finance.yahoo.com` — urutan sama dengan server, jadi
  outage identik di kedua sisi.
- **Edge cache 60s**: Cloudflare cache response per (host, path,
  query) selama 60 detik. Drastically cut upstream load.
- **CORS-friendly** (`Access-Control-Allow-Origin: *`) supaya
  worker juga bisa dipanggil langsung dari browser saat dev.

## Test cepat

```bash
# Health check
curl https://fintrack-yahoo-proxy.<your-subdomain>.workers.dev/health

# BBCA quote
curl 'https://fintrack-yahoo-proxy.<your-subdomain>.workers.dev/v8/finance/chart/BBCA.JK?interval=1d&range=1d'

# Search
curl 'https://fintrack-yahoo-proxy.<your-subdomain>.workers.dev/v1/finance/search?q=bbca&quotesCount=5'
```

## Limit

- Free plan: 100k request/hari.
- Paid plan ($5/bulan): 10M request/bulan.
- Cache hit gratis, tidak dihitung ke limit.

## Monitoring

Buka https://dash.cloudflare.com → Workers & Pages →
fintrack-yahoo-proxy → Logs untuk lihat status 200/502/timeout.
