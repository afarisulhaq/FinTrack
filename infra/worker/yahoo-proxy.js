/**
 * Cloudflare Worker that proxies Yahoo Finance requests through
 * Cloudflare's IP range.
 *
 * Why: Yahoo Finance aggressively rate-limits (and sometimes
 * outright 429s) requests from common VPS / datacenter IP ranges
 * (AWS, DigitalOcean, Hetzner, Vultr, ...). Cloudflare's edge IPs
 * are usually allowed through, so routing our server's chart &
 * search requests through this worker is the simplest way to keep
 * market data flowing.
 *
 * Deploy:
 *   npm install -g wrangler
 *   wrangler login
 *   wrangler deploy
 *
 * The default `name` below is "fintrack-yahoo-proxy". After
 * `wrangler deploy` you'll get a URL like
 *   https://fintrack-yahoo-proxy.<your-subdomain>.workers.dev
 * Set that as `YAHOO_PROXY_URL` in the FinTrack server's
 * `.env.production`.
 *
 * Security: this is NOT an open proxy. The worker only forwards
 * to a hard-coded allowlist of Yahoo Finance hosts. Anything else
 * returns 400. Bot/crawler scanners can't repurpose it.
 */

// Allowlisted upstream hosts. We try them in order; the first to
// return a 2xx wins. Mirrors the order in
// server/services/market-price.ts so a Yahoo outage that hits
// query2 first is identical on both sides.
const YAHOO_HOSTS = [
  "https://query2.finance.yahoo.com",
  "https://query1.finance.yahoo.com",
];

// Anything outside this list (e.g. /wp-admin, /etc/passwd) gets
// rejected. The worker only knows how to forward to Yahoo Finance.
const YAHOO_PATH_RE = /^\/v\d+\/finance\//;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

async function fetchFromYahoo(pathAndQuery) {
  const errors = [];
  for (const host of YAHOO_HOSTS) {
    const target = `${host}${pathAndQuery}`;
    try {
      const resp = await fetch(target, {
        headers: {
          // Yahoo refuses requests with no UA or with curl/python
          // default UAs. Pretend to be a real Chrome on Windows.
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        // Cache at Cloudflare's edge for 60s. Yahoo's data only
        // changes every few seconds during market hours, and a
        // 60s TTL massively cuts the upstream load.
        cf: {
          cacheTtl: 60,
          cacheEverything: true,
          cacheKey: target,
        },
        redirect: "follow",
      });
      if (resp.ok) return resp;
      errors.push(`${host} -> ${resp.status}`);
    } catch (err) {
      errors.push(
        `${host} -> ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  console.warn(`[yahoo-proxy] all hosts failed: ${errors.join("; ")}`);
  return null;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

export default {
  async fetch(request) {
    // CORS preflight — the FinTrack server runs server-side, not
    // from a browser, so this rarely fires, but it's harmless and
    // keeps the worker usable for direct browser hits during dev.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200, headers: CORS_HEADERS });
    }

    if (!YAHOO_PATH_RE.test(url.pathname)) {
      return jsonResponse(400, {
        error: "Only /v*/finance/* paths are proxied",
      });
    }

    const pathAndQuery = url.pathname + url.search;
    const upstream = await fetchFromYahoo(pathAndQuery);
    if (!upstream) {
      return jsonResponse(502, {
        error: "All Yahoo Finance hosts failed",
      });
    }

    // Forward the upstream body verbatim. We don't try to parse
    // and re-serialize — that would just add latency and risk
    // breaking exotic Yahoo payloads.
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        // Hint to the FinTrack server's intermediate caches (and
        // the FinTrack client) that the answer is fresh for a
        // minute. The actual persistent cache in
        // market-price.ts is the source of truth — this is just
        // a backstop.
        "Cache-Control": "public, max-age=60",
      },
    });
  },
};
