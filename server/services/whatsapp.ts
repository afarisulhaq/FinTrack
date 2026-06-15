import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { db as prisma, canUseDatabase } from "../prisma-client.js";
import { parseFinanceText, ocrReceiptImage } from "./ai-parser.js";
import type { ParseResult } from "./ai-parser.js";

type WhatsAppStatus = "disconnected" | "connecting" | "connected";
type WhatsAppSocket = {
  end: (error?: Error) => void;
  logout: () => Promise<void>;
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
  requestPairingCode?: (phone: string) => Promise<string>;
  ev: {
    on: (event: string, listener: (...args: any[]) => void) => void;
  };
};

let socket: WhatsAppSocket | null = null;
let reconnecting = false;
let manuallyStopped = false;
let whatsappState = {
  status: "disconnected" as WhatsAppStatus,
  qr: null as string | null,
  qrDataUrl: null as string | null,
  pairingCode: null as string | null,
  lastError: null as string | null,
  phone: null as string | null,
  connectedUserId: null as string | null,
};

// In-memory store of known WhatsApp contacts (jid -> pushname/name)
// Populated from incoming messages and contacts.upsert events
const knownContacts = new Map<string, string>();

export function whatsappStatus() {
  return { ...whatsappState };
}

export function setWhatsAppConnectedUser(userId: string | null) {
  whatsappState.connectedUserId = userId;
}

/**
 * Returns all known WhatsApp contacts (people who have messaged the bot
 * or are in the bot's contact list).
 */
export function getWhatsAppContacts(): Array<{
  jid: string;
  phone: string;
  name: string;
}> {
  const contacts: Array<{ jid: string; phone: string; name: string }> = [];
  for (const [jid, name] of knownContacts.entries()) {
    const phone = jid.split("@")[0]?.replace(/"/g, "") ?? "";
    contacts.push({ jid, phone, name });
  }
  // Sort by name, then by phone
  contacts.sort((a, b) => {
    if (a.name && b.name) return a.name.localeCompare(b.name);
    if (a.name) return -1;
    if (b.name) return 1;
    return a.phone.localeCompare(b.phone);
  });
  return contacts;
}

function normalizeWhatsAppJid(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "62");
  return digits.includes("@s.whatsapp.net")
    ? digits
    : `${digits}@s.whatsapp.net`;
}

function phoneFromJid(jid: string): string {
  return jid.replace(/[^\d]/g, "");
}

/**
 * Best-effort wallet matching:
 * 1. Exact match (case-insensitive)
 * 2. Remove "dompet " prefix, re-check exact
 * 3. startsWith match
 * 4. includes match (prioritize shorter names)
 * Returns the matched wallet or null.
 */
function findBestWallet(
  walletName: string,
  wallets: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const lower = walletName.toLowerCase().replace(/^dompet\s+/i, "");
  if (!wallets.length) return null;

  // 1. Exact match
  const exact = wallets.find((w) => w.name.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Try prefix removal on each wallet too
  const noPrefix = wallets.find(
    (w) => w.name.toLowerCase().replace(/^dompet\s+/i, "") === lower,
  );
  if (noPrefix) return noPrefix;

  // 3. startsWith
  const startsWith = wallets.find((w) =>
    w.name.toLowerCase().startsWith(lower),
  );
  if (startsWith) return startsWith;

  // 4. includes — prefer wallets where the parsed name is fully contained
  //    in the wallet name, sorted by shortest name first (most likely match)
  const sorted = [...wallets].sort((a, b) => a.name.length - b.name.length);
  const includes = sorted.find((w) => lower.includes(w.name.toLowerCase()));
  if (includes) return includes;

  // 5. Check if any wallet name is contained in the parsed name
  const contained = sorted.find((w) => w.name.toLowerCase().includes(lower));
  if (contained) return contained;

  return null;
}

export async function startWhatsAppBot() {
  if (socket && whatsappState.status !== "disconnected")
    return whatsappStatus();

  manuallyStopped = false;
  whatsappState = {
    ...whatsappState,
    status: "connecting",
    lastError: null,
  };

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason } = baileys;
    const sessionDir = process.env.WHATSAPP_SESSION_DIR ?? "./.baileys-session";
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const activeSocket = makeWASocket({
      auth: state,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
    }) as WhatsAppSocket;
    socket = activeSocket;

    // Ignore stale close/open events from older sockets.
    const isCurrentSocket = () => socket === activeSocket;

    // Track contacts from Baileys contact list
    activeSocket.ev.on("contacts.upsert", async (contacts: any) => {
      for (const contact of contacts) {
        if (contact?.id || contact?.jid) {
          const cid = contact.id || contact.jid;
          knownContacts.set(
            cid,
            contact.name ||
              contact.notify ||
              contact.verifiedName ||
              cid.split("@")[0] ||
              "",
          );
        }
      }
    });

    activeSocket.ev.on("creds.update", saveCreds);
    activeSocket.ev.on(
      "connection.update",
      async (update: {
        qr?: string;
        connection?: string;
        lastDisconnect?: { error?: unknown };
      }) => {
        if (!isCurrentSocket()) return;

        if (update.qr) {
          whatsappState = {
            ...whatsappState,
            qr: update.qr,
            qrDataUrl: await QRCode.toDataURL(update.qr, {
              width: 320,
              margin: 2,
            }),
            status: "connecting",
          };
        }

        if (update.connection === "open") {
          reconnecting = false;
          // Extract WhatsApp account phone from Baileys auth state
          const waId = (state as any)?.creds?.me?.id as string | undefined;
          const phoneFromCreds = waId
            ? (waId.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? null)
            : null;
          whatsappState = {
            ...whatsappState,
            status: "connected",
            qr: null,
            qrDataUrl: null,
            phone: phoneFromCreds ?? whatsappState.phone,
            lastError: null,
          };

          // Auto-resolve connected user if not set
          // Gunakan nomor HP dari creds untuk lookup yang akurat
          void resolveUserFromPhone(phoneFromCreds ?? "").then((uid) => {
            if (uid) setWhatsAppConnectedUser(uid);
          });
        }

        if (update.connection === "close") {
          if (!isCurrentSocket()) return;

          socket = null;
          const err = update.lastDisconnect?.error;
          const errMsg = getBaileysErrorMessage(err);
          // Baileys uses Boom which wraps DisconnectReason as output.statusCode
          const reason = (
            err as { output?: { statusCode?: number } } | undefined
          )?.output?.statusCode;

          // Do not auto-clear session on generic connection errors.
          // Clearing during QR/pairing registration can destroy a fresh session
          // and cause long login loops. Use Reset Sesi explicitly when needed.
          if (isSessionCorruptionError(err)) {
            console.warn("[WhatsApp] Connection error detected:", errMsg);
          }

          whatsappState = {
            ...whatsappState,
            status: "disconnected",
            qr: null,
            qrDataUrl: null,
            lastError:
              errMsg !== "unknown"
                ? errMsg
                : `Disconnected: ${reason ?? "unknown"}`,
          };

          if (
            reason !== DisconnectReason.loggedOut &&
            !reconnecting &&
            !manuallyStopped
          ) {
            reconnecting = true;
            setTimeout(() => {
              if (!manuallyStopped) void startWhatsAppBot();
            }, 2000);
          }
        }
      },
    );

    activeSocket.ev.on(
      "messages.upsert",
      async (event: {
        messages?: Array<{
          key?: { fromMe?: boolean; remoteJid?: string | null };
          message?: {
            conversation?: string;
            extendedTextMessage?: { text?: string | null };
            imageMessage?: { caption?: string | null };
          } | null;
        }>;
      }) => {
        for (const message of event.messages ?? []) {
          const jid = message.key?.remoteJid;
          if (!jid || message.key?.fromMe || jid === "status@broadcast")
            continue;

          // Extract text from various message types:
          // - conversation (plain text)
          // - extendedTextMessage (text with formatting)
          // - imageMessage.caption (photo with caption)
          const msg = message.message;
          const rawText =
            msg?.conversation ??
            msg?.extendedTextMessage?.text ??
            msg?.imageMessage?.caption ??
            "";

          // Track this contact via pushName
          const pushName = (message as any).pushName ?? "";
          if (jid && !knownContacts.has(jid)) {
            knownContacts.set(jid, pushName || phoneFromJid(jid));
          } else if (jid && pushName) {
            knownContacts.set(jid, pushName);
          }

          // ─── OCR for image messages ──────────────────────────────
          // If image has no caption OR caption has no amount, run OCR
          const hasImage = !!msg?.imageMessage;
          let text = rawText.trim();

          if (hasImage && (!text || parseFinanceText(text).amount <= 0)) {
            try {
              const { downloadMediaMessage } =
                await import("@whiskeysockets/baileys");
              // Local `message` is a narrow mirror of Baileys' WAMessage
              // (the messages.upsert listener declares key/message as
              // optional). By this point we know `message.key` is defined
              // (filtered above) and the image is present — cast to any
              // to satisfy downloadMediaMessage's stricter signature.
              const buffer = await downloadMediaMessage(
                message as any,
                "buffer",
                {},
              );
              const ocrAmount = await ocrReceiptImage(buffer);
              if (ocrAmount) {
                text = text ? `${text} ${ocrAmount}` : ocrAmount;
                console.log(
                  `[WhatsApp] OCR extracted: ${ocrAmount}, combined: "${text}"`,
                );
              }
            } catch (err) {
              console.error("[WhatsApp] OCR error:", err);
            }
          }

          if (!text) {
            // Still no text after OCR attempt
            if (msg?.imageMessage) {
              try {
                await activeSocket.sendMessage(jid, {
                  text: "📸 Untuk gambar nota, kirimkan dengan caption berisi nominal dan kategori.\n\nContoh: beli sembako 50rb",
                });
              } catch {
                /* ignore */
              }
            }
            continue;
          }

          try {
            const reply = await handleIncomingMessage(jid, text);
            if (reply) {
              await activeSocket.sendMessage(jid, { text: reply });
            }
          } catch (err) {
            const errMsg =
              err instanceof Error ? err.message : "Gagal memproses pesan";
            console.error("[WhatsApp] Error processing message:", errMsg);
            await activeSocket.sendMessage(jid, {
              text: `❌ Gagal memproses pesan: ${errMsg}`,
            });
          }
        }
      },
    );

    return whatsappStatus();
  } catch (error) {
    socket = null;
    whatsappState = {
      ...whatsappState,
      status: "disconnected",
      qr: null,
      qrDataUrl: null,
      pairingCode: null,
      lastError:
        error instanceof Error ? error.message : "WhatsApp start failed",
    };
    return whatsappStatus();
  }
}

async function resolveUserFromPhone(phone: string): Promise<string | null> {
  // First try: use the connected user (bot owner) directly
  if (whatsappState.connectedUserId) {
    return whatsappState.connectedUserId;
  }

  try {
    // Skip phone-based matching when no phone provided (auto-resolve after restart)
    if (phone) {
      // Fallback: try exact match on channelPhone
      const setting = await prisma.notificationSetting.findFirst({
        where: { channelPhone: phone },
      });
      if (setting?.userId) return setting.userId;

      // Try last 10 digits
      const strippedPhone = phone.replace(/^0+/, "62");
      if (strippedPhone.length >= 10) {
        const altSetting = await prisma.notificationSetting.findFirst({
          where: { channelPhone: { endsWith: strippedPhone.slice(-10) } },
        });
        if (altSetting?.userId) return altSetting.userId;
      }
    }

    // Final fallback: find any user with WhatsApp configured
    if (phone || whatsappState.status === "connected") {
      const anyWA = await prisma.notificationSetting.findFirst({
        where: {
          OR: [{ channelWA: true }, { channelPhone: { not: "" } }],
          userId: { not: null },
        },
      });
      if (anyWA?.userId) return anyWA.userId;

      // Ultimate fallback: any user with a notification setting
      const anyUser = await prisma.notificationSetting.findFirst({
        where: { userId: { not: null } },
      });
      if (anyUser?.userId) return anyUser.userId;

      // Try User model by phone (personal finance: WA number == user phone)
      if (phone) {
        const userByPhone = await prisma.user.findFirst({
          where: { phone: phone },
        });
        if (userByPhone?.id) return userByPhone.id;
      }

      // Absolute last resort: first active user
      const firstUser = await prisma.user.findFirst({
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
      });
      if (firstUser?.id) return firstUser.id;
    }
  } catch (error) {
    console.warn(
      "[WhatsApp] resolveUserFromPhone DB error:",
      error instanceof Error ? error.message : error,
    );
  }

  return null;
}

/**
 * Handle saldo command for WhatsApp.
 */
async function handleWASaldo(userId: string): Promise<string> {
  const wallets = await prisma.wallet.findMany({ where: { userId } });
  if (wallets.length === 0)
    return "Belum ada dompet. Buat dulu di halaman Wallets.";
  const lines = wallets.map(
    (w) => `👛 ${w.name}: Rp${Number(w.balance).toLocaleString("id-ID")}`,
  );
  return [`💰 *Saldo Dompet*`, ...lines].join("\n");
}

/**
 * Handle laporan command for WhatsApp.
 */
async function handleWALaporan(userId: string): Promise<string> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const expenses = await prisma.transaction.findMany({
    where: {
      userId,
      type: "expense",
      date: { gte: startOfWeek },
    },
  });

  if (expenses.length === 0) return "📊 Belum ada transaksi minggu ini.";

  const total = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const topCategory = expenses.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + Number(tx.amount);
    return acc;
  }, {});
  const top = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0];

  return [
    `📊 *Laporan Minggu Ini*`,
    `Total: Rp${total.toLocaleString("id-ID")}`,
    `Transaksi: ${expenses.length}`,
    top ? `Terbanyak: ${top[0]} (Rp${top[1].toLocaleString("id-ID")})` : "",
  ].join("\n");
}

/**
 * Handle an incoming WhatsApp message:
 * 1. Check for commands (/saldo, /laporan)
 * 2. Extract phone from JID
 * 3. Look up user by phone
 * 4. Parse text & create transaction
 */
async function handleIncomingMessage(
  jid: string,
  text: string,
): Promise<string> {
  const phone = jid.split("@")[0] ?? "";
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (!(await canUseDatabase())) {
    return "⚠️ Database tidak tersedia. Transaksi tidak bisa diproses.";
  }

  // Resolve user from phone
  const userId = await resolveUserFromPhone(phone);
  if (!userId) {
    return ""; // Silently ignore - unknown user
  }

  // ─── Permission check ──────────────────────────────────────────────
  // Bot owner is always allowed; other contacts must be in permissions list
  const ownerPhone = whatsappState.phone;
  if (phone !== ownerPhone) {
    const ownerId = whatsappState.connectedUserId;
    if (ownerId) {
      try {
        const allowed = await prisma.botPermission.findFirst({
          where: {
            userId: ownerId,
            channel: "whatsapp",
            contactId: phone,
          },
        });
        if (!allowed) {
          return ""; // Silently ignore - not allowed
        }
      } catch {
        // If DB check fails, allow by default
      }
    }
  }

  // ─── Handle commands ────────────────────────────────────────────────
  if (lower === "/saldo") {
    return handleWASaldo(userId);
  }
  if (lower === "/laporan") {
    return handleWALaporan(userId);
  }

  // ─── Parse as transaction ───────────────────────────────────────────
  const parsed = parseFinanceText(trimmed);

  if (parsed.amount <= 0) {
    return parsed.reply;
  }

  try {
    // Find wallet by name (smart matching)
    const wallets = await prisma.wallet.findMany({ where: { userId } });
    const matchedWallet = findBestWallet(parsed.wallet, wallets);
    const wallet = matchedWallet ?? wallets[0] ?? null;

    if (!wallet) {
      return (
        parsed.reply +
        "\n\n⚠️ Tidak ada dompet ditemukan. Buat dompet dulu di halaman Wallets."
      );
    }

    // Create the transaction
    await prisma.transaction.create({
      data: {
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category,
        categoryIcon: "💰",
        walletId: wallet.id,
        walletName: wallet.name,
        description: parsed.description,
        date: new Date(),
        userId,
      },
    });

    // Update wallet balance
    const changeAmount = parsed.amount;
    if (changeAmount > 0) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance:
            parsed.type === "income"
              ? { increment: changeAmount }
              : { decrement: changeAmount },
        },
      });
    }

    // Fetch updated wallet for the new balance
    const updatedWallet = await prisma.wallet.findUnique({
      where: { id: wallet.id },
    });
    const newBalance = `Rp${(updatedWallet ? Number(updatedWallet.balance) : 0).toLocaleString("id-ID")}`;
    const formattedAmount = `Rp${parsed.amount.toLocaleString("id-ID")}`;

    return [
      `✅ *Transaksi Berhasil Dicatat!*`,
      `💸 Pengeluaran: ${formattedAmount}`,
      `📂 Kategori: ${parsed.category}`,
      `👛 Dompet: ${wallet.name}`,
      `💰 Saldo: ${newBalance}`,
      `📝 ${parsed.description}`,
      ``,
      `Balas: /saldo atau /laporan`,
    ].join("\n");
  } catch (error) {
    console.error("[WhatsApp] Transaction creation error:", error);
    return parsed.reply + "\n\n❌ Gagal menyimpan transaksi ke database.";
  }
}

export async function startWhatsAppBotWithPairing(phone: string) {
  // If already connected, no need to request a new pairing code.
  if (socket && whatsappState.status === "connected") return whatsappStatus();

  // If a QR/connecting socket is already running, close it first so the
  // pairing-code flow does not race with the QR registration flow.
  if (socket) {
    manuallyStopped = true;
    try {
      socket.end(new Error("Restarting WhatsApp socket for pairing code"));
    } catch {
      /* ignore */
    }
    socket = null;
  }

  manuallyStopped = false;
  whatsappState = {
    ...whatsappState,
    status: "connecting",
    lastError: null,
    pairingCode: null,
  };

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const makeWASocket = baileys.default;
    const { useMultiFileAuthState, DisconnectReason } = baileys;
    const sessionDir = process.env.WHATSAPP_SESSION_DIR ?? "./.baileys-session";
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const activeSocket = makeWASocket({
      auth: state,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
    }) as WhatsAppSocket;
    socket = activeSocket;

    // Ignore stale close/open events from older sockets.
    const isCurrentSocket = () => socket === activeSocket;

    // Track contacts from Baileys contact list
    activeSocket.ev.on("contacts.upsert", async (contacts: any) => {
      for (const contact of contacts) {
        if (contact?.id || contact?.jid) {
          const cid = contact.id || contact.jid;
          knownContacts.set(
            cid,
            contact.name ||
              contact.notify ||
              contact.verifiedName ||
              cid.split("@")[0] ||
              "",
          );
        }
      }
    });

    activeSocket.ev.on("creds.update", saveCreds);
    activeSocket.ev.on(
      "connection.update",
      async (update: {
        qr?: string;
        connection?: string;
        lastDisconnect?: { error?: unknown };
      }) => {
        if (!isCurrentSocket()) return;

        if (update.qr) {
          whatsappState = {
            ...whatsappState,
            qr: update.qr,
            qrDataUrl: await QRCode.toDataURL(update.qr, {
              width: 320,
              margin: 2,
            }),
            status: "connecting",
          };
        }

        if (update.connection === "open") {
          reconnecting = false;
          // Extract WhatsApp account phone from Baileys auth state
          const waId = (state as any)?.creds?.me?.id as string | undefined;
          const phoneFromCreds = waId
            ? (waId.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? null)
            : null;
          whatsappState = {
            ...whatsappState,
            status: "connected",
            qr: null,
            qrDataUrl: null,
            pairingCode: null,
            phone: phoneFromCreds ?? whatsappState.phone,
            lastError: null,
          };

          // Auto-resolve connected user if not set
          // Gunakan nomor HP dari creds untuk lookup yang akurat
          void resolveUserFromPhone(phoneFromCreds ?? "").then((uid) => {
            if (uid) setWhatsAppConnectedUser(uid);
          });
        }

        if (update.connection === "close") {
          if (!isCurrentSocket()) return;

          socket = null;
          const err = update.lastDisconnect?.error;
          const errMsg = getBaileysErrorMessage(err);
          // Baileys uses Boom which wraps DisconnectReason as output.statusCode
          const reason = (
            err as { output?: { statusCode?: number } } | undefined
          )?.output?.statusCode;

          // Do not auto-clear session on generic connection errors.
          // Clearing during QR/pairing registration can destroy a fresh session
          // and cause long login loops. Use Reset Sesi explicitly when needed.
          if (isSessionCorruptionError(err)) {
            console.warn("[WhatsApp] Connection error detected:", errMsg);
          }

          whatsappState = {
            ...whatsappState,
            status: "disconnected",
            qr: null,
            qrDataUrl: null,
            pairingCode: null,
            lastError:
              errMsg !== "unknown"
                ? errMsg
                : `Disconnected: ${reason ?? "unknown"}`,
          };

          if (
            reason !== DisconnectReason.loggedOut &&
            !reconnecting &&
            !manuallyStopped
          ) {
            reconnecting = true;
            setTimeout(() => {
              if (!manuallyStopped) void startWhatsAppBot();
            }, 2000);
          }
        }
      },
    );

    const isRegistered = Boolean(
      (state as { creds?: { registered?: boolean } }).creds?.registered,
    );
    const pairingPhone = phone.replace(/\D/g, "");
    if (pairingPhone && !isRegistered && activeSocket.requestPairingCode) {
      try {
        // Give the websocket a short moment to finish its initial WA handshake.
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        const code = await activeSocket.requestPairingCode(pairingPhone);
        const formatted = code.match(/.{1,4}/g)?.join("-") ?? code;
        whatsappState = {
          ...whatsappState,
          status: "connecting",
          pairingCode: formatted,
          lastError: null,
        };
      } catch (error) {
        whatsappState = {
          ...whatsappState,
          lastError:
            error instanceof Error ? error.message : "Pairing request failed",
        };
      }
    }

    activeSocket.ev.on(
      "messages.upsert",
      async (event: {
        messages?: Array<{
          key?: { fromMe?: boolean; remoteJid?: string | null };
          message?: {
            conversation?: string;
            extendedTextMessage?: { text?: string | null };
            imageMessage?: { caption?: string | null };
          } | null;
        }>;
      }) => {
        for (const message of event.messages ?? []) {
          const jid = message.key?.remoteJid;
          if (!jid || message.key?.fromMe || jid === "status@broadcast")
            continue;

          // Extract text from various message types
          const msg = message.message;
          const rawText =
            msg?.conversation ??
            msg?.extendedTextMessage?.text ??
            msg?.imageMessage?.caption ??
            "";

          // Track this contact
          const pushName = (message as any).pushName ?? "";
          if (jid && !knownContacts.has(jid)) {
            knownContacts.set(jid, pushName || phoneFromJid(jid));
          } else if (jid && pushName) {
            knownContacts.set(jid, pushName);
          }

          // ─── OCR for image messages ──────────────────────────────
          const hasImage = !!msg?.imageMessage;
          let text = rawText.trim();

          if (hasImage && (!text || parseFinanceText(text).amount <= 0)) {
            try {
              const { downloadMediaMessage } =
                await import("@whiskeysockets/baileys");
              // See note on the matching call in the first listener.
              const buffer = await downloadMediaMessage(
                message as any,
                "buffer",
                {},
              );
              const ocrAmount = await ocrReceiptImage(buffer);
              if (ocrAmount) {
                text = text ? `${text} ${ocrAmount}` : ocrAmount;
                console.log(
                  `[WhatsApp] OCR extracted: ${ocrAmount}, combined: "${text}"`,
                );
              }
            } catch (err) {
              console.error("[WhatsApp] OCR error:", err);
            }
          }

          if (!text) {
            if (msg?.imageMessage) {
              try {
                await activeSocket.sendMessage(jid, {
                  text: "📸 Untuk gambar nota, kirimkan dengan caption berisi nominal dan kategori.\n\nContoh: beli sembako 50rb",
                });
              } catch {
                /* ignore */
              }
            }
            continue;
          }

          try {
            const reply = await handleIncomingMessage(jid, text);
            if (reply) {
              await activeSocket.sendMessage(jid, { text: reply });
            }
          } catch (err) {
            const errMsg =
              err instanceof Error ? err.message : "Gagal memproses pesan";
            console.error("[WhatsApp] Error processing message:", errMsg);
            await activeSocket.sendMessage(jid, {
              text: `❌ Gagal memproses pesan: ${errMsg}`,
            });
          }
        }
      },
    );

    return whatsappStatus();
  } catch (error) {
    socket = null;
    whatsappState = {
      ...whatsappState,
      status: "disconnected",
      qr: null,
      qrDataUrl: null,
      pairingCode: null,
      lastError:
        error instanceof Error ? error.message : "WhatsApp start failed",
    };
    return whatsappStatus();
  }
}

export async function stopWhatsAppBot() {
  const activeSocket = socket;
  manuallyStopped = true;
  socket = null;
  reconnecting = false;
  if (activeSocket) {
    // Important: do not call logout() here.
    // logout() removes the linked-device session, so every reconnect becomes
    // a slow full pairing/QR registration again. Use Reset Sesi for that.
    try {
      activeSocket.end(new Error("FinTrack WhatsApp socket stopped"));
    } catch {
      /* ignore */
    }
  }
  whatsappState = {
    status: "disconnected",
    qr: null,
    qrDataUrl: null,
    pairingCode: null,
    lastError: null,
    phone: whatsappState.phone,
    connectedUserId: whatsappState.connectedUserId,
  };
  return whatsappStatus();
}

export async function sendWhatsAppMessage(phone: string, text: string) {
  if (!socket || whatsappState.status !== "connected") {
    return { ok: false, error: "WhatsApp belum terhubung" };
  }
  if (!phone.trim()) return { ok: false, error: "Nomor WhatsApp wajib diisi" };
  if (!text.trim()) return { ok: false, error: "Pesan tidak boleh kosong" };

  try {
    await socket.sendMessage(normalizeWhatsAppJid(phone), { text });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Pesan WhatsApp gagal dikirim",
    };
  }
}

/**
 * Extract the underlying error message from a Baileys disconnect error.
 * Baileys wraps errors in Boom objects; this extracts the actual message.
 */
function getBaileysErrorMessage(error: unknown): string {
  if (!error) return "unknown";
  // Try Boom format: { output: { statusCode }, message }
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? "";
    if (typeof msg === "string" && msg) return msg;
    // Try nested error
    if (obj.error instanceof Error) return obj.error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Detect if a Baileys error is caused by corrupt session data.
 * This typically happens when the noise handshake fails (decodeFrame error)
 * which shows up as "Connection Failure" or "Stream Errored".
 */
function isSessionCorruptionError(error: unknown): boolean {
  const msg = getBaileysErrorMessage(error).toLowerCase();
  return (
    msg.includes("connection failure") ||
    msg.includes("stream errored") ||
    msg.includes("decode") ||
    msg.includes("handshake") ||
    msg.includes("noise")
  );
}

/**
 * Get the path to the Baileys session directory.
 */
function getSessionDir(): string {
  return process.env.WHATSAPP_SESSION_DIR ?? "./.baileys-session";
}

/**
 * Delete the WhatsApp session directory to force a fresh pairing.
 * This is useful when the session data gets corrupted.
 */
export async function resetWhatsAppSession(): Promise<{
  ok: boolean;
  error?: string;
}> {
  // First, stop the bot if it's running
  await stopWhatsAppBot();

  const sessionDir = getSessionDir();
  try {
    if (fs.existsSync(sessionDir)) {
      const files = fs.readdirSync(sessionDir);
      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        fs.rmSync(filePath, { force: true, recursive: true });
      }
      console.log("[WhatsApp] Session directory cleared:", sessionDir);
    }
    whatsappState = {
      status: "disconnected",
      qr: null,
      qrDataUrl: null,
      pairingCode: null,
      lastError: null,
      phone: null,
      connectedUserId: null,
    };
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp] Failed to clear session:", msg);
    return { ok: false, error: msg };
  }
}
