import { randomUUID } from "node:crypto";

export class Provider {
  constructor(store, fetchImpl = fetch) {
    this.store = store;
    this.fetch = fetchImpl;
    this.refreshing = null;
  }
  headers(device = randomUUID()) {
    return {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      "accept-language": "id",
      "authentication-type": "go-id",
      "gojek-country-code": "ID",
      "gojek-timezone": "Asia/Jakarta",
      origin: "https://portal.gofoodmerchant.co.id",
      referer: "https://portal.gofoodmerchant.co.id/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      "x-appid": "go-biz-web-dashboard",
      "x-appversion": "platform-v3.111.0-1708bc9a",
      "x-deviceos": "Web",
      "x-phonemake": "Windows 10 64-bit",
      "x-phonemodel": "Chrome 150.0.0.0 on Windows 10 64-bit",
      "x-platform": "Web",
      "x-uniqueid": device,
      "x-user-locale": "en-GB",
      "x-user-type": "merchant",
    };
  }
  async request(url, options) {
    let response;
    try {
      response = await this.fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("GoBiz belum bisa dihubungi. Coba lagi nanti");
    }
    if (response.status === 429)
      throw new Error(
        "GoBiz membatasi permintaan. Tunggu sebelum mencoba lagi",
      );
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Sesi atau kode OTP ditolak GoBiz. Hubungkan ulang akun"
          : "Permintaan ditolak GoBiz. Periksa akun merchant",
      );
    try {
      return await response.json();
    } catch {
      throw new Error("Respons GoBiz tidak valid");
    }
  }
  async requestOtp(phone) {
    const normalized = phone.replace(/^\+?62|^0/, "");
    if (!/^8\d{8,12}$/.test(normalized))
      throw new Error("Nomor HP merchant tidak valid");
    const device = randomUUID();
    const response = await this.request(
      "https://api.gobiz.co.id/goid/login/request",
      {
        method: "POST",
        headers: this.headers(device),
        body: JSON.stringify({
          client_id: "go-biz-web-new",
          phone_number: normalized,
          country_code: "62",
        }),
      },
    );
    const token = response.otp_token ?? response.data?.otp_token;
    if (typeof token !== "string" || !token)
      throw new Error("GoBiz tidak mengembalikan token OTP");
    this.store.setSecret("otp", {
      token,
      phone: normalized,
      device,
      expires: Date.now() + 720_000,
    });
    this.store.log("otp_requested");
    return {
      phone: "+62" + normalized.slice(0, 3) + "••••" + normalized.slice(-3),
      expires_at: new Date(Date.now() + 720_000).toISOString(),
    };
  }
  saveTokens(data, previous) {
    const token = data.data ?? data;
    if (
      typeof token.access_token !== "string" ||
      !token.access_token ||
      typeof (token.refresh_token ?? previous.refresh_token) !== "string"
    )
      throw new Error("Respons sesi GoBiz tidak valid");
    const seconds = Number(token.expires_in ?? 3600);
    if (!Number.isFinite(seconds) || seconds <= 0)
      throw new Error("Masa berlaku sesi GoBiz tidak valid");
    const session = {
      ...previous,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? previous.refresh_token,
      expires_at: Date.now() + seconds * 1000,
    };
    this.store.setSecret("merchant_session", session);
    return session;
  }
  async verifyOtp(code) {
    if (!/^\d{4}$/.test(code)) throw new Error("Kode OTP harus empat digit");
    const challenge = this.store.secret("otp");
    if (!challenge || challenge.expires < Date.now())
      throw new Error("OTP belum diminta atau sudah kedaluwarsa");
    const response = await this.request("https://api.gobiz.co.id/goid/token", {
      method: "POST",
      headers: this.headers(challenge.device),
      body: JSON.stringify({
        client_id: "go-biz-web-new",
        grant_type: "otp",
        data: { otp: code, otp_token: challenge.token },
      }),
    });
    this.saveTokens(response, {
      phone_number: challenge.phone,
      device: challenge.device,
    });
    this.store.set("otp", null);
    this.store.log("merchant_connected");
    return this.status();
  }
  status() {
    const session = this.store.secret("merchant_session");
    return {
      connected: Boolean(session),
      expires_at: session ? new Date(session.expires_at).toISOString() : null,
      merchant_id: this.store.get("merchant") ?? "",
      dedicated: Boolean(this.store.get("dedicated")),
      qris_configured: Boolean(this.store.secret("qris")),
    };
  }
  async session(force = false) {
    const session = this.store.secret("merchant_session");
    if (!session) throw new Error("Akun merchant belum terhubung");
    if (!force && session.expires_at > Date.now() + 60_000) return session;
    if (!this.refreshing)
      this.refreshing = (async () => {
        const response = await this.request(
          "https://api.gobiz.co.id/goid/token",
          {
            method: "POST",
            headers: this.headers(session.device),
            body: JSON.stringify({
              client_id: "go-biz-web-new",
              grant_type: "refresh_token",
              data: {
                refresh_token: session.refresh_token,
                phone_number: session.phone_number,
                country_code: "62",
              },
            }),
          },
        );
        return this.saveTokens(response, session);
      })().finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }
  async transactions(start, end, merchant = this.store.get("merchant")) {
    if (!merchant || merchant !== this.store.get("merchant"))
      throw new Error("Merchant tidak sesuai konfigurasi gateway");
    const session = await this.session();
    const query = new URLSearchParams({
      from: "0",
      size: "100",
      statuses: "SETTLEMENT,CAPTURE,REFUND,PARTIAL_REFUND",
      payment_types: "QRIS",
      start_time: new Date(start).toISOString(),
      end_time: new Date(end).toISOString(),
      merchant_ids: merchant,
    });
    const response = await this.request(
      `https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions?${query}`,
      {
        headers: {
          ...this.headers(session.device),
          Authorization: "Bearer " + session.access_token,
          Cookie: `access_token=${session.access_token}; refresh_token=${session.refresh_token}; auth_method=goid`,
        },
      },
    );
    const rows = response.transactions ?? response.data?.transactions;
    if (!Array.isArray(rows))
      throw new Error("Format mutasi GoPay tidak dikenali");
    return rows.map((row) => {
      const id = row.id ?? row.order_id ?? row.wallstreet_transaction_id;
      const amount = Number(
        row.gross_amount ??
          row.real_gross_amount ??
          row.amount?.value ??
          row.amount,
      );
      const time = Date.parse(
        row.transaction_time ?? row.created_at ?? row.settlement_time,
      );
      if (
        typeof id !== "string" ||
        !id ||
        !Number.isSafeInteger(amount) ||
        !Number.isFinite(time) ||
        typeof row.transaction_status !== "string"
      )
        throw new Error("Data mutasi tidak lengkap untuk verifikasi");
      const result = {
        id,
        amount,
        time,
        status: row.transaction_status.toLowerCase(),
        issuer: String(row.qris_provider_aspi_issuer ?? "").slice(0, 100),
      };
      this.store.db
        .prepare(
          "INSERT INTO transactions VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,amount=excluded.amount,time=excluded.time,issuer=excluded.issuer",
        )
        .run(
          result.id,
          result.amount,
          result.status,
          result.time,
          result.issuer,
        );
      return result;
    });
  }
  async check(invoice) {
    if (invoice.status === "paid") return invoice;
    if (Date.now() > invoice.expires + 86_400_000)
      throw new Error(
        "Jendela pemeriksaan berakhir; pembayaran perlu ditinjau manual",
      );
    if (invoice.checked && Date.now() - invoice.checked < 15_000)
      throw new Error("Tunggu 15 detik sebelum memeriksa lagi");
    this.store.db
      .prepare("UPDATE invoices SET checked=? WHERE id=?")
      .run(Date.now(), invoice.id);
    const rows = await this.transactions(
      invoice.created,
      Math.min(Date.now(), invoice.expires),
      invoice.merchant,
    );
    return this.store.settle(invoice.id, rows);
  }
}
