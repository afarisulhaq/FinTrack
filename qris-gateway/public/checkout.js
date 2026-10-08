const id = location.pathname.split("/").pop();
const target = document.querySelector("#payment"),
  error = document.querySelector("#checkout-error"),
  retry = document.querySelector("#retry");
const money = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let invoice,
  busy = false,
  nextCheck = 0;
async function request(check = false) {
  if (busy) return;
  busy = true;
  error.textContent = "";
  retry.hidden = true;
  const button = document.querySelector("#check");
  if (button) button.disabled = true;
  try {
    const response = await fetch(
      `/public/invoices/${id}${check ? "/check" : ""}`,
      check
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }
        : {},
    );
    const json = await response.json();
    if (!response.ok || !json.success)
      throw Error(json.error ?? "Invoice belum bisa dimuat");
    invoice = json.data;
    render();
  } catch (cause) {
    error.textContent = cause.message;
    retry.hidden = false;
  } finally {
    busy = false;
    tick();
  }
}
function render() {
  const status =
    invoice.status === "paid"
      ? "Lunas"
      : invoice.status === "expired"
        ? "Batas pembayaran berakhir"
        : "Menunggu pembayaran";
  target.innerHTML = `<p>${esc(invoice.description || invoice.reference || "Invoice QRIS")}</p><p class="payment-total amount">${money(invoice.amount)}</p><dl class="payment-breakdown"><div><dt>Harga dasar</dt><dd>${money(invoice.base_amount)}</dd></div><div><dt>Nominal unik</dt><dd>${money(invoice.unique_amount)}</dd></div></dl><p class="state ${esc(invoice.status)}" role="status">${status}</p>${invoice.status === "pending" ? `<img class="qr-image" src="/qris/${esc(id)}.svg" alt="QRIS pembayaran ${money(invoice.amount)}">` : ""}<p id="countdown" class="muted"></p><p class="footnote">ID: ${esc(id)}</p>${invoice.status !== "paid" ? '<button id="check" class="primary">Periksa pembayaran</button>' : '<p class="muted">Pembayaran sudah tercatat. Kamu dapat menutup halaman ini.</p>'}`;
  document.querySelector("#check")?.addEventListener("click", () => {
    nextCheck = Date.now() + 15000;
    void request(true);
  });
  tick();
}
function tick() {
  if (!invoice) return;
  const expired = Date.now() >= Date.parse(invoice.expires_at);
  if (expired && invoice.status === "pending") {
    invoice.status = "expired";
    render();
    return;
  }
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(invoice.expires_at) - Date.now()) / 1000),
  );
  const countdown = document.querySelector("#countdown");
  if (countdown)
    countdown.textContent =
      invoice.status === "paid"
        ? ""
        : expired
          ? "Jangan bayar QRIS lama. Jika sudah membayar tepat waktu, periksa status kembali."
          : `Sisa waktu ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const button = document.querySelector("#check");
  if (button)
    button.disabled =
      busy ||
      Date.now() < nextCheck ||
      Date.now() > Date.parse(invoice.expires_at) + 86400000;
}
retry.addEventListener("click", () => void request());
setInterval(tick, 1000);
void request();
