const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
const date = (value) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value)) + " WIB";
const names = {
  overview: "Ringkasan",
  invoices: "Invoice QRIS",
  transactions: "Mutasi",
  connection: "Koneksi merchant",
  keys: "API & integrasi",
};
const statuses = {
  pending: "Menunggu",
  paid: "Lunas",
  expired: "Kedaluwarsa",
  settlement: "Settlement",
  capture: "Capture",
  refund: "Refund",
  partial_refund: "Refund sebagian",
};
let csrf = "",
  data = null,
  keys = [],
  selected = null,
  nextCheck = 0,
  invoiceKey = "";
const route = () =>
  names[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
function notice(text = "") {
  $("#notice").textContent = text;
  $("#notice").hidden = !text;
}
function failure(text = "") {
  $("#page-error").textContent = text;
  $("#page-error").hidden = !text;
}
async function api(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
            ...(path === "/dashboard/invoices"
              ? { "Idempotency-Key": invoiceKey }
              : {}),
          },
          body: JSON.stringify(body),
        },
  );
  const json = await response.json();
  if (!response.ok || !json.success) {
    if (response.status === 401 && path !== "/dashboard/login") showLogin();
    throw Error(json.error ?? "Permintaan gagal. Coba lagi.");
  }
  return json.data;
}
function showLogin() {
  $("#workspace").hidden = true;
  $("#login-screen").hidden = false;
  csrf = "";
  data = null;
  keys = [];
  $("#new-key").value = "";
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
}
async function load() {
  $("#refresh").disabled = true;
  failure();
  try {
    data = await api("/dashboard/overview");
    if (route() === "keys") keys = await api("/dashboard/keys");
    render();
  } catch (error) {
    failure(error.message);
  } finally {
    $("#refresh").disabled = false;
  }
}
function state(status) {
  return `<span class="state ${esc(status)}">${esc(statuses[status] ?? status)}</span>`;
}
function invoiceTable(invoices) {
  if (!invoices.length)
    return '<div class="empty">Belum ada invoice. Hubungkan merchant dan buat invoice QRIS pertama untuk mulai menerima pembayaran.</div>';
  return `<div class="ledger"><table><thead><tr><th>Invoice</th><th>Dibuat</th><th class="numeric">Total</th><th>Status</th><th>Rincian</th></tr></thead><tbody>${invoices.map((row) => `<tr><td>${esc(row.reference || row.id.slice(0, 8))}<small>${esc(row.description)}</small></td><td>${date(row.created_at)}</td><td class="numeric amount">${money(row.amount)}</td><td>${state(row.status)}</td><td><button class="small" data-invoice="${esc(row.id)}">Lihat</button></td></tr>`).join("")}</tbody></table></div>`;
}
function render() {
  if (!data) return;
  const view = route();
  $("#page-title").textContent = names[view];
  document.querySelectorAll("nav a").forEach((link) => {
    const active = link.hash === "#" + view;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const content = $("#content"),
    merchant = data.merchant;
  if (view === "overview")
    content.innerHTML = `<section class="panel balance-panel section"><div><p class="eyebrow">Pembayaran invoice tercatat</p><p class="value amount">${money(data.stats.received)}</p><p class="muted">Total invoice lunas di gateway ini. Angka ini bukan saldo merchant.</p></div><div class="balance-side"><div><strong>${data.stats.paid ?? 0}</strong><span class="muted">Invoice lunas</span></div><div><strong>${data.stats.pending ?? 0}</strong><span class="muted">Menunggu pembayaran</span></div></div></section><section class="panel section"><div class="panel-header"><div><h2>Invoice terbaru</h2><p class="muted">Pembayaran dan batas waktu setiap invoice.</p></div><button class="primary" data-create ${!merchant.connected || !merchant.qris_configured ? "disabled" : ""}>Buat invoice QRIS</button></div>${invoiceTable(data.invoices.slice(0, 8))}</section><div class="split"><section class="panel"><h2>Koneksi merchant</h2><div class="status-line"><span>${merchant.merchant_id ? esc(merchant.merchant_id) : "Merchant belum diatur"}</span>${state(merchant.connected ? "Sesi tersimpan" : "Belum terhubung")}</div><p class="muted">${merchant.connected ? "Sesi akan diperbarui saat diperlukan. Periksa mutasi untuk memastikan koneksi GoBiz masih berfungsi." : "Hubungkan akun GoBiz dan QRIS statis sebelum membuat invoice."}</p><a class="link-button" href="#connection">Kelola koneksi</a></section><section class="panel"><h2>Aktivitas gateway</h2>${
      data.logs.length
        ? `<ul class="entry-list">${data.logs
            .slice(0, 5)
            .map(
              (log) =>
                `<li>${esc(log.event.replaceAll("_", " "))}<br><small>${date(log.time)}</small></li>`,
            )
            .join("")}</ul>`
        : '<p class="empty">Belum ada aktivitas.</p>'
    }</section></div>`;
  if (view === "invoices")
    content.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>Invoice QRIS</h2><p class="muted">100 invoice terbaru. QRIS menggunakan tambahan nominal unik yang tidak digunakan kembali.</p></div><button data-create class="primary" ${!merchant.connected || !merchant.qris_configured ? "disabled" : ""}>Buat invoice QRIS</button></div><div class="filters"><input id="invoice-filter" aria-label="Cari referensi invoice" placeholder="Cari referensi atau keterangan"></div><div id="invoice-results">${invoiceTable(data.invoices)}</div></section>`;
  if (view === "transactions")
    content.innerHTML = `<section class="panel"><div class="panel-header"><div><h2>Mutasi merchant</h2><p class="muted">Mutasi QRIS yang sudah diambil dari GoPay, termasuk refund. Sinkronisasi mengambil 24 jam terakhir, maksimal 100 transaksi.</p></div><button id="sync" class="primary" ${!merchant.connected ? "disabled" : ""}>Sinkronkan mutasi</button></div>${data.transactions.length ? `<div class="ledger"><table><thead><tr><th>Transaksi</th><th>Waktu</th><th class="numeric">Nominal</th><th>Status</th></tr></thead><tbody>${data.transactions.map((row) => `<tr><td class="mono">${esc(row.id)}<small>${esc(row.issuer || "Issuer belum tersedia")}</small></td><td>${date(row.time)}</td><td class="numeric amount">${money(row.amount)}</td><td>${state(row.status)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Belum ada mutasi tersimpan. Hubungkan merchant, lalu sinkronkan untuk mengambil transaksi.</p>'}</section>`;
  if (view === "connection")
    content.innerHTML = `<div class="split"><section class="panel"><h2>Akun GoBiz</h2><p class="muted">Masuk menggunakan nomor HP akun merchant. OTP dan sesi hanya diproses oleh server gateway.</p><div class="status-line"><span>${merchant.connected ? "Sesi merchant tersimpan" : "Akun belum terhubung"}</span>${merchant.connected && merchant.expires_at ? `<small class="muted">Berlaku sampai ${date(merchant.expires_at)}</small>` : ""}</div><form id="otp-request"><label>Nomor HP merchant<input name="phone" type="tel" autocomplete="tel" placeholder="08…" required></label><button class="primary">Kirim OTP</button></form><form id="otp-verify" class="section"><label>Kode OTP<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4}" minlength="4" maxlength="4" required></label><button>Hubungkan akun</button></form>${merchant.connected ? '<button id="disconnect" class="danger">Putuskan sesi merchant</button>' : ""}<p class="footnote">Integrasi tidak resmi, berdasarkan repo GoPay Merchant Gateway. Perubahan API GoBiz bisa membutuhkan penyesuaian adapter.</p></section><section class="panel"><h2>Merchant & QRIS statis</h2><p class="muted">Merchant ID harus sesuai dengan QRIS statis dari akun yang terhubung.</p><form id="merchant-settings"><label>Merchant ID<input name="merchant" value="${esc(merchant.merchant_id)}" pattern="[a-zA-Z0-9_-]{1,100}" required></label><label>Payload QRIS statis<textarea name="qris" placeholder="${merchant.qris_configured ? "Sudah tersimpan. Kosongkan untuk mempertahankan QRIS." : "Tempel payload QRIS statis merchant."}" maxlength="2048" ${merchant.qris_configured ? "" : "required"}></textarea></label><label class="checkbox"><input type="checkbox" name="dedicated" required ${merchant.dedicated ? "checked" : ""}><span>Merchant ini khusus gateway. Saya memastikan merchant ID dan QRIS berasal dari akun yang sama.</span></label><button class="primary">Simpan konfigurasi</button></form><p class="footnote">Setelah ada invoice, merchant ID tidak bisa diganti. Gunakan instance baru untuk akun merchant lain.</p></section></div>`;
  if (view === "keys") {
    const example = [
      "POST /v1/invoices",
      "X-Api-Key: [API_KEY]",
      "Idempotency-Key: [ORDER_ID]",
      "Content-Type: application/json",
      "",
      '{"amount": [HARGA_DASAR], "reference": "[ORDER_ID]"}',
    ].join("\n");
    const config = [
      "GOPAY_GATEWAY_URL=" + location.origin,
      "GOPAY_GATEWAY_API_KEY=[API_KEY]",
      "GOPAY_GATEWAY_MERCHANT_ID=" + (merchant.merchant_id || "[MERCHANT_ID]"),
    ].join("\n");
    content.innerHTML = `<div class="split"><section class="panel"><h2>API key</h2><p class="muted">Gunakan di backend aplikasi. API key dapat membuat invoice dan membaca mutasi merchant; jangan masukkan ke frontend.</p><form id="key-form"><label>Nama integrasi<input name="name" placeholder="Contoh: FinTrack" maxlength="80" required></label><button class="primary">Buat API key</button></form><ul class="entry-list key-list">${keys.map((key) => `<li><div>${esc(key.name)}<br><small class="mono">${esc(key.prefix)}… · ${key.revoked ? "Dicabut" : "Aktif"}</small></div>${!key.revoked ? `<button class="danger small" data-revoke="${esc(key.id)}">Cabut key</button>` : ""}</li>`).join("")}</ul></section><section class="panel"><h2>Hubungkan aplikasi</h2><p class="muted">Buat invoice dari backend. Gunakan Idempotency-Key yang sama ketika mengulang permintaan invoice yang sama.</p><pre><code>${esc(example)}</code></pre><p class="muted">Respons berisi total, nominal unik, QRIS, dan URL pembayaran. Periksa dengan <code>POST /v1/invoices/:id/check</code>.</p><h3>FinTrack</h3><p class="muted">Endpoint kompatibilitas: <code>POST /create-qris</code> dan <code>GET /transactions</code>. Nominal dikirim persis dari FinTrack tanpa tambahan kedua.</p><pre><code>${esc(config)}</code></pre></section></div>`;
  }
  wire();
}
function wire() {
  document.querySelectorAll("[data-create]").forEach((button) =>
    button.addEventListener("click", () => {
      invoiceKey = crypto.randomUUID();
      $("#invoice-form").reset();
      $("#invoice-form .dialog-error").textContent = "";
      $("#invoice-dialog").showModal();
    }),
  );
  const wireRows = () =>
    document
      .querySelectorAll("[data-invoice]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          showPayment(button.dataset.invoice),
        ),
      );
  wireRows();
  $("#invoice-filter")?.addEventListener("input", (event) => {
    const term = event.target.value.toLowerCase();
    $("#invoice-results").innerHTML = invoiceTable(
      data.invoices.filter((row) =>
        `${row.reference} ${row.description} ${row.id}`
          .toLowerCase()
          .includes(term),
      ),
    );
    wireRows();
  });
  $("#sync")?.addEventListener("click", (event) =>
    action(event.target, async () => {
      await api("/dashboard/transactions/sync", {});
      await load();
      notice("Mutasi sudah disinkronkan.");
    }),
  );
  $("#otp-request")?.addEventListener("submit", (event) =>
    formAction(event, async (values) => {
      const result = await api("/dashboard/otp/request", {
        phone: values.get("phone"),
      });
      notice(
        `OTP dikirim ke ${result.phone}. Masukkan kode empat digit untuk menghubungkan akun.`,
      );
    }),
  );
  $("#otp-verify")?.addEventListener("submit", (event) =>
    formAction(event, async (values) => {
      await api("/dashboard/otp/verify", { code: values.get("code") });
      await load();
      notice(
        "Sesi merchant sudah tersimpan. Atur merchant ID dan QRIS untuk membuat invoice.",
      );
    }),
  );
  $("#merchant-settings")?.addEventListener("submit", (event) =>
    formAction(event, async (values) => {
      await api("/dashboard/settings", {
        merchant: values.get("merchant"),
        qris: values.get("qris"),
        dedicated: values.get("dedicated") === "on",
      });
      await load();
      notice("Konfigurasi merchant sudah disimpan.");
    }),
  );
  $("#disconnect")?.addEventListener("click", (event) =>
    action(event.target, async () => {
      if (!confirm("Putuskan sesi GoBiz? Invoice dan riwayat tetap tersimpan."))
        return;
      await api("/dashboard/merchant/disconnect", {});
      await load();
      notice("Sesi merchant sudah diputus.");
    }),
  );
  $("#key-form")?.addEventListener("submit", (event) =>
    formAction(event, async (values) => {
      const result = await api("/dashboard/keys", { name: values.get("name") });
      $("#new-key").value = result.key;
      $("#copy-status").textContent = "";
      $("#key-dialog").showModal();
      await load();
    }),
  );
  document.querySelectorAll("[data-revoke]").forEach((button) =>
    button.addEventListener("click", () =>
      action(button, async () => {
        if (
          !confirm(
            "Cabut API key ini? Aplikasi yang memakainya tidak bisa mengakses gateway lagi.",
          )
        )
          return;
        await api(`/dashboard/keys/${button.dataset.revoke}/revoke`, {});
        await load();
        notice("API key sudah dicabut.");
      }),
    ),
  );
}
async function action(button, fn, localError) {
  if (button.disabled) return;
  button.disabled = true;
  failure();
  if (localError) localError.textContent = "";
  try {
    await fn();
  } catch (error) {
    if (localError) localError.textContent = error.message;
    else failure(error.message);
  } finally {
    button.disabled = false;
  }
}
function formAction(event, fn) {
  event.preventDefault();
  const form = event.target;
  void action(
    form.querySelector("button[type=submit],button"),
    () => fn(new FormData(form)),
    form.querySelector(".dialog-error"),
  );
}
function showPayment(id) {
  selected = data.invoices.find((row) => row.id === id);
  if (!selected) return;
  $("#payment-dialog .dialog-error").textContent = "";
  renderPayment();
  if (!$("#payment-dialog").open) $("#payment-dialog").showModal();
}
function renderPayment() {
  if (!selected) return;
  const row = selected;
  $("#payment-details").innerHTML =
    `<p>${esc(row.description || row.reference || "Invoice QRIS")}</p><p class="payment-total amount">${money(row.amount)}</p><dl class="payment-breakdown"><div><dt>Harga dasar</dt><dd>${money(row.base_amount)}</dd></div><div><dt>Nominal unik</dt><dd>${money(row.unique_amount)}</dd></div></dl><p>${state(row.status)}</p>${row.status === "pending" ? `<img class="qr-image" src="/qris/${esc(row.id)}.svg" alt="QRIS ${money(row.amount)}">` : ""}<p id="invoice-countdown" class="muted"></p><p class="footnote">ID: ${esc(row.id)}<br>Batas pembayaran: ${date(row.expires_at)}</p><div class="payment-actions">${row.status !== "paid" ? '<button id="check-invoice" class="primary">Periksa pembayaran</button>' : ""}<a class="link-button" href="${esc(row.qris_url)}" target="_blank" rel="noopener noreferrer">Buka halaman bayar</a><button id="copy-payment" class="quiet">Salin link</button></div><p id="payment-copy-status" role="status"></p>`;
  $("#check-invoice")?.addEventListener("click", (event) =>
    action(
      event.target,
      async () => {
        nextCheck = Date.now() + 15000;
        selected = await api(`/dashboard/invoices/${row.id}/check`, {});
        await load();
        renderPayment();
      },
      $("#payment-dialog .dialog-error"),
    ),
  );
  $("#copy-payment").addEventListener("click", () =>
    copy(row.qris_url, $("#payment-copy-status")),
  );
  tick();
}
function tick() {
  if (!selected || !$("#payment-dialog").open) return;
  const expired = Date.now() >= Date.parse(selected.expires_at);
  if (expired && selected.status === "pending") {
    selected.status = "expired";
    renderPayment();
    return;
  }
  const text = $("#invoice-countdown");
  if (!text) return;
  const seconds = Math.max(
    0,
    Math.ceil((Date.parse(selected.expires_at) - Date.now()) / 1000),
  );
  text.textContent =
    selected.status === "paid"
      ? "Pembayaran sudah tercatat."
      : expired
        ? "Jangan bayar QRIS lama. Pembayaran terlambat perlu ditinjau manual."
        : `Sisa waktu ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const button = $("#check-invoice");
  if (button)
    button.disabled =
      Date.now() < nextCheck ||
      Date.now() > Date.parse(selected.expires_at) + 86400000;
}
async function copy(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    label.textContent = "Sudah disalin.";
  } catch {
    label.textContent =
      "Penyalinan otomatis tidak tersedia. Pilih dan salin teks secara manual.";
  }
}
$("#login-form").addEventListener("submit", (event) =>
  formAction(event, async (values) => {
    try {
      const session = await api("/dashboard/login", {
        username: values.get("username"),
        password: values.get("password"),
      });
      csrf = session.csrf;
      $("#operator").textContent = values.get("username");
      $("#login-form").reset();
      $("#login-error").textContent = "";
      $("#login-screen").hidden = true;
      $("#workspace").hidden = false;
      await load();
    } catch (error) {
      $("#login-error").textContent = error.message;
    }
  }),
);
$("#invoice-form").addEventListener("submit", (event) =>
  formAction(event, async (values) => {
    const invoice = await api("/dashboard/invoices", {
      reference: values.get("reference"),
      description: values.get("description"),
      amount: Number(values.get("amount")),
    });
    $("#invoice-dialog").close();
    await load();
    showPayment(invoice.id);
  }),
);
$("#logout").addEventListener("click", (event) =>
  action(event.target, async () => {
    await api("/dashboard/logout", {});
    showLogin();
  }),
);
$("#refresh").addEventListener("click", () => void load());
$("#close-invoice").addEventListener("click", () =>
  $("#invoice-dialog").close(),
);
$("#close-payment").addEventListener("click", () =>
  $("#payment-dialog").close(),
);
$("#close-key").addEventListener("click", () => $("#key-dialog").close());
$("#key-dialog").addEventListener("close", () => {
  $("#new-key").value = "";
  $("#copy-status").textContent = "";
});
$("#copy-key").addEventListener("click", () =>
  copy($("#new-key").value, $("#copy-status")),
);
function theme(value) {
  document.documentElement.classList.toggle("dark", value === "dark");
  $("#theme-button").textContent =
    value === "dark" ? "Tema terang" : "Tema gelap";
  localStorage.setItem("qris_theme", value);
}
theme(
  localStorage.getItem("qris_theme") ??
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
);
$("#theme-button").addEventListener("click", () =>
  theme(document.documentElement.classList.contains("dark") ? "light" : "dark"),
);
addEventListener("hashchange", () => {
  notice();
  void load();
});
setInterval(tick, 1000);
try {
  const session = await api("/dashboard/session");
  csrf = session.csrf;
  $("#operator").textContent = session.username;
  $("#login-screen").hidden = true;
  $("#workspace").hidden = false;
  await load();
} catch {
  showLogin();
}
