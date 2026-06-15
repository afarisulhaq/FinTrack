"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Phone,
  Send,
  XCircle,
} from "lucide-react";
import { PageWrapper } from "~/components/layout/page-wrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardBody, CardHeader } from "~/components/ui/card";
import { Modal } from "~/components/ui/modal";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useAuthStore } from "~/store/useAuthStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageFrom = "user" | "bot";
type MessageType = "text" | "image";

interface ChatMessage {
  id: string;
  from: MessageFrom;
  content: string;
  type: MessageType;
  time: string;
}

interface BotCommand {
  cmd: string;
  desc: string;
}

interface SupportedStore {
  name: string;
  emoji: string;
}

interface ReceiptItem {
  name: string;
  price: string;
}

interface OcrResult {
  store: string;
  date: string;
  items: Array<{ name: string; amount: number }>;
  total: number;
  suggestedCategory: string;
  suggestedWallet: string;
  confidence: number;
}

interface BotStatusResult {
  whatsapp: {
    status: "disconnected" | "connecting" | "connected";
    qrDataUrl?: string | null;
    pairingCode?: string | null;
    lastError?: string | null;
    phone?: string | null;
  };
  telegram: {
    configured: boolean;
    defaultChatConfigured: boolean;
    username?: string | null;
    name?: string | null;
  };
  telegramUserConfig?: {
    configured: boolean;
    botToken: string | null;
    chatId: string | null;
  };
}

interface BotPermissionItem {
  id: string;
  userId: string;
  channel: string;
  contactName: string;
  contactId: string;
  createdAt: string;
}

interface BotContact {
  jid?: string;
  phone?: string;
  name: string;
  chatId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WA_PHONE = "+62 812-3456-7890";
// Telegram handle is derived from the brand name so it stays in sync
// with the configured `appName` (see useAppConfigStore).
const fallbackTelegramHandle = (appName: string) =>
  `@${appName.replace(/\s+/g, "")}Bot`;

const WA_COMMANDS: BotCommand[] = [
  { cmd: "/saldo", desc: "Cek saldo dompet" },
  { cmd: "/laporan", desc: "Laporan minggu ini" },
  { cmd: "beli kopi 25rb", desc: "Catat dengan bahasa natural" },
  { cmd: "/catat 50000 makan", desc: "Catat pengeluaran" },
  { cmd: "/transfer [dari] [ke] [jumlah]", desc: "Catat transfer" },
];

const SUPPORTED_STORES: SupportedStore[] = [
  { name: "Alfamart", emoji: "🏪" },
  { name: "Indomaret", emoji: "🏬" },
  { name: "McDonald's", emoji: "🍟" },
  { name: "KFC", emoji: "🍗" },
  { name: "Tokopedia", emoji: "🛒" },
];

const OCR_ITEMS: ReceiptItem[] = [
  { name: "Indomie Goreng × 3", price: "Rp9.750" },
  { name: "Aqua 600ml", price: "Rp4.500" },
  { name: "Teh Botol", price: "Rp5.000" },
];

const MOCK_CHAT: ChatMessage[] = [
  {
    id: "1",
    from: "user",
    content: "beli kopi 25rb pakai kantong jajan",
    type: "text",
    time: "09:42",
  },
  {
    id: "2",
    from: "bot",
    content:
      "✅ Dicatat!\n💸 Pengeluaran: Rp25.000\n📂 Kategori: Kopi & Minuman\n👛 Dompet: Kantong Jajan\n📅 7 Jun 2026",
    type: "text",
    time: "09:42",
  },
  {
    id: "3",
    from: "user",
    content: "saldo",
    type: "text",
    time: "09:45",
  },
  {
    id: "4",
    from: "bot",
    content:
      "💰 Saldo Dompet Kamu:\n🏦 BCA: Rp15.000.000\n└ 🍔 Kantong Jajan: Rp475.000\n└ 💰 Kantong Tabungan: Rp3.000.000\n🏛️ Mandiri: Rp8.000.000\n\n💎 Total: Rp23.750.000",
    type: "text",
    time: "09:45",
  },
  {
    id: "5",
    from: "user",
    content: "[foto struk Alfamart]",
    type: "image",
    time: "10:12",
  },
  {
    id: "6",
    from: "bot",
    content:
      "📸 Struk terdeteksi!\n🏪 Alfamart - 07 Jun 2026\n\nItem:\n• Indomie Goreng × 3 = Rp9.750\n• Aqua 600ml = Rp4.500\n• Teh Botol = Rp5.000\n\n💰 Total: Rp19.250\n\nKonfirmasi ke dompet mana? (ketik nama dompet)",
    type: "text",
    time: "10:12",
  },
  {
    id: "7",
    from: "user",
    content: "kantong jajan",
    type: "text",
    time: "10:13",
  },
  {
    id: "8",
    from: "bot",
    content: "✅ Tersimpan! Rp19.250 dari Kantong Jajan",
    type: "text",
    time: "10:13",
  },
  {
    id: "9",
    from: "user",
    content: "laporan minggu ini",
    type: "text",
    time: "11:30",
  },
  {
    id: "10",
    from: "bot",
    content:
      "📊 Laporan 1–7 Jun 2026:\n\n💚 Pemasukan: Rp0\n❤️ Pengeluaran: Rp485.250\n\nTop kategori:\n1. 🍔 Makan: Rp185.000 (38%)\n2. 🚗 Transport: Rp120.000 (25%)\n3. ☕ Kopi: Rp44.250 (9%)",
    type: "text",
    time: "11:30",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepList({
  steps,
  accentStyle,
}: {
  steps: string[];
  accentStyle?: React.CSSProperties;
}) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li
          key={i}
          className="text-text-secondary flex items-start gap-3 text-sm"
        >
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={accentStyle}
          >
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function ChatBubble({ msg, index }: { msg: ChatMessage; index: number }) {
  const isUser = msg.from === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.07, duration: 0.22, ease: "easeOut" }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser ? (
        <div className="flex max-w-[85%] items-end gap-2">
          <div className="bg-primary/20 mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm select-none">
            🤖
          </div>
          <div>
            <div className="border-border bg-bg-elevated rounded-2xl rounded-tl-sm border px-3.5 py-2.5">
              <pre className="text-text-primary font-sans text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
                {msg.content}
              </pre>
            </div>
            <p className="text-text-muted mt-1 pl-1 text-[10px]">{msg.time}</p>
          </div>
        </div>
      ) : (
        <div className="max-w-[80%]">
          {msg.type === "image" ? (
            <div className="border-border bg-bg-elevated overflow-hidden rounded-2xl rounded-tr-sm border">
              <div className="border-border flex h-28 w-48 flex-col items-center justify-center gap-1.5 border-b">
                <Camera className="text-text-muted h-6 w-6" />
                <span className="text-text-muted text-xs">foto struk</span>
              </div>
              <p className="text-text-muted px-3 py-1.5 text-xs">
                Struk Alfamart
              </p>
            </div>
          ) : (
            <div className="bg-primary rounded-2xl rounded-tr-sm px-3.5 py-2.5">
              <p className="text-sm text-white">{msg.content}</p>
            </div>
          )}
          <p className="text-text-muted mt-1 pr-1 text-right text-[10px]">
            {msg.time}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiBotPage() {
  const appName = useAppConfigStore((s) => s.config.appName);
  const tgHandleFallback = fallbackTelegramHandle(appName);
  const [waConnected, setWaConnected] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waQrDataUrl, setWaQrDataUrl] = useState<string | null>(null);
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [tgConnected, setTgConnected] = useState(false);
  const [telegramHandle, setTelegramHandle] = useState(tgHandleFallback);
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgConnecting, setTgConnecting] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrAnalyzing, setOcrAnalyzing] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [liveMessages, setLiveMessages] = useState(MOCK_CHAT);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [botStatus, setBotStatus] = useState<string | null>(null);
  const [pollWhatsAppStatus, setPollWhatsAppStatus] = useState(false);
  const [permissions, setPermissions] = useState<BotPermissionItem[]>([]);
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [permissionTab, setPermissionTab] = useState<"whatsapp" | "telegram">(
    "whatsapp",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [waContacts, setWaContacts] = useState<BotContact[]>([]);
  const [tgContacts, setTgContacts] = useState<BotContact[]>([]);
  const token = useAuthStore((state) => state.token);

  // Sync phoneInput when waPhone is loaded from backend
  useEffect(() => {
    if (waPhone && !phoneInput) {
      setPhoneInput(waPhone);
    }
  }, [waPhone]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatEndRef = useRef<HTMLDivElement>(null);
  const displayedOcrItems = ocrResult
    ? ocrResult.items.map((item) => ({
        name: item.name,
        price: `Rp${item.amount.toLocaleString("id-ID")}`,
      }))
    : OCR_ITEMS;
  const displayedOcrTotal = ocrResult
    ? `Rp${ocrResult.total.toLocaleString("id-ID")}`
    : "Rp19.250";
  const displayedOcrCategory = ocrResult?.suggestedCategory ?? "Belanja";
  const displayedOcrWallet = ocrResult?.suggestedWallet ?? "Kantong Jajan";

  // Scroll chat to bottom after stagger animations complete
  useEffect(() => {
    const timer = setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      MOCK_CHAT.length * 70 + 200,
    );
    return () => clearTimeout(timer);
  }, []);

  async function refreshBotStatus(options?: { silent?: boolean }) {
    if (!token || token === "dev-fallback-token") return null;
    try {
      const result = await api.get<BotStatusResult>("/bot/status", token);
      const backendConnected = result.whatsapp.status === "connected";
      const backendConnecting = result.whatsapp.status === "connecting";
      setWaConnected(backendConnected);
      setWaConnecting(backendConnecting);
      setWaQrDataUrl(result.whatsapp.qrDataUrl ?? null);
      setWaPairingCode(result.whatsapp.pairingCode ?? null);
      setWaPhone(result.whatsapp.phone || phoneInput || "");
      setTgConnected(result.telegram.configured);
      setTelegramHandle(result.telegram.username ?? tgHandleFallback);
      // Pre-fill telegram token if user has one saved
      if (result.telegramUserConfig?.configured) {
        setTgConnected(true);
      }
      setPollWhatsAppStatus(backendConnecting);
      if (backendConnected) {
        setBotStatus("WhatsApp: connected");
      } else if (!options?.silent) {
        setBotStatus(
          result.whatsapp.qrDataUrl
            ? "Scan QR WhatsApp di bawah untuk pairing Baileys."
            : result.whatsapp.lastError
              ? `WhatsApp: ${result.whatsapp.lastError}`
              : backendConnecting
                ? "WhatsApp: connecting"
                : "Status bot backend dimuat.",
        );
      }
      return result;
    } catch {
      if (!options?.silent) {
        setBotStatus(
          "Backend bot belum tersedia. Jalankan backend Elysia di port 4000.",
        );
      }
      return null;
    }
  }

  useEffect(() => {
    void refreshBotStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // WhatsApp tidak auto-connect saat page load.
  // User harus memilih manual: Hubungkan WhatsApp (QR) atau Pairing Code.
  // Ini mencegah QR/pairing stale dan login timeout saat halaman baru dibuka.

  // Poll WhatsApp status continuously:
  // - Every 2s when connecting
  // - Every 10s when connected (to detect disconnection)
  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;
    if (!pollWhatsAppStatus && !waConnected) return;
    const interval = pollWhatsAppStatus ? 2000 : 10000;
    const timer = window.setInterval(() => {
      void refreshBotStatus({ silent: true });
    }, interval);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollWhatsAppStatus, waConnected, token]);

  // Fetch permissions and available contacts
  useEffect(() => {
    if (!token || token === "dev-fallback-token") return;
    void (async () => {
      try {
        const perms = await api.get<BotPermissionItem[]>(
          "/bot/permissions",
          token,
        );
        setPermissions(perms);
      } catch {
        /* ignore */
      }
      try {
        const contacts = await api.get<{
          whatsapp: BotContact[];
          telegram: BotContact[];
        }>("/bot/contacts", token);
        setWaContacts(contacts.whatsapp ?? []);
        setTgContacts(contacts.telegram ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, [token]);

  async function handleAnalyzeOcr() {
    setOcrAnalyzing(true);
    setOcrDone(false);
    try {
      if (token && token !== "dev-fallback-token") {
        const result = await api.post<OcrResult>("/bot/ocr-demo", token, {});
        setOcrResult(result);
      } else {
        setOcrResult(null);
      }
    } catch (error) {
      console.warn("OCR endpoint unavailable, using UI fallback", error);
      setOcrResult(null);
    }
    setTimeout(() => {
      setOcrAnalyzing(false);
      setOcrDone(true);
    }, 900);
  }

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message || sendingChat) return;
    setSendingChat(true);
    setChatInput("");
    const time = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setLiveMessages((items) => [
      ...items,
      {
        id: `user-${Date.now()}`,
        from: "user",
        content: message,
        type: "text",
        time,
      },
    ]);
    // Handle special bot commands
    const lowerMsg = message.toLowerCase();
    if (lowerMsg === "/saldo" && token && token !== "dev-fallback-token") {
      try {
        // Fetch wallets from bootstrap
        const bootstrap = await api.get<{
          wallets: Array<{ name: string; balance: number }>;
        }>("/bootstrap", token);
        const replies = (bootstrap.wallets ?? []).map(
          (w) => `👛 ${w.name}: Rp${w.balance.toLocaleString("id-ID")}`,
        );
        const reply =
          replies.length > 0
            ? `💰 *Saldo Dompet*\n\n${replies.join("\n")}`
            : "Belum ada dompet.";
        setLiveMessages((items) => [
          ...items,
          {
            id: `bot-${Date.now()}`,
            from: "bot",
            content: reply,
            type: "text",
            time,
          },
        ]);
        return;
      } catch {
        // Fall through to normal chat
      }
    }

    if (lowerMsg === "/laporan" && token && token !== "dev-fallback-token") {
      try {
        const bootstrap = await api.get<{
          transactions: Array<{
            type: string;
            amount: number;
            category: string;
            date: string;
          }>;
        }>("/bootstrap", token);
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const weekTx = (bootstrap.transactions ?? []).filter(
          (tx) => new Date(tx.date) >= startOfWeek && tx.type === "expense",
        );
        const total = weekTx.reduce((sum, tx) => sum + tx.amount, 0);
        const reply =
          weekTx.length > 0
            ? `📊 *Laporan Minggu Ini*\nTotal: Rp${total.toLocaleString("id-ID")}\nTransaksi: ${weekTx.length}\n\nTerbanyak: ${weekTx.sort((a, b) => b.amount - a.amount)[0]?.category ?? "-"}`
            : "📊 Belum ada transaksi minggu ini.";
        setLiveMessages((items) => [
          ...items,
          {
            id: `bot-${Date.now()}`,
            from: "bot",
            content: reply,
            type: "text",
            time,
          },
        ]);
        return;
      } catch {
        // Fall through to normal chat
      }
    }

    try {
      const result =
        token && token !== "dev-fallback-token"
          ? await api.post<{ reply: string }>("/bot/chat", token, { message })
          : {
              reply:
                "✅ Demo lokal: pesan diterima. Jalankan backend agar parser AI aktif.",
            };
      setLiveMessages((items) => [
        ...items,
        {
          id: `bot-${Date.now()}`,
          from: "bot",
          content: result.reply,
          type: "text",
          time,
        },
      ]);
    } catch (error) {
      setLiveMessages((items) => [
        ...items,
        {
          id: `bot-${Date.now()}`,
          from: "bot",
          content:
            "⚠️ Backend bot belum tersedia. Pastikan backend berjalan di port 4000.",
          type: "text",
          time,
        },
      ]);
    } finally {
      setSendingChat(false);
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    }
  }

  async function handleResetSession() {
    if (!token || token === "dev-fallback-token") return;
    try {
      setBotStatus("Menghapus sesi WhatsApp...");
      await api.post("/bot/whatsapp/reset", token, {});
      setWaConnected(false);
      setWaConnecting(false);
      setWaQrDataUrl(null);
      setWaPairingCode(null);
      setBotStatus(
        "✅ Sesi WhatsApp berhasil direset. Klik 'Hubungkan WhatsApp (QR)' untuk memulai ulang.",
      );
    } catch (error) {
      setBotStatus(
        error instanceof Error ? error.message : "Gagal mereset sesi WhatsApp.",
      );
    }
  }

  async function handleStartWhatsApp() {
    if (!token || token === "dev-fallback-token") {
      setWaConnected(false);
      setWaConnecting(false);
      setWaQrDataUrl(null);
      setBotStatus(
        "WhatsApp real memakai Baileys. Login lewat backend dan jalankan `npm run dev:server`, lalu klik hubungkan lagi untuk QR pairing.",
      );
      return;
    }

    try {
      const endpoint =
        waConnected || waConnecting
          ? "/bot/whatsapp/stop"
          : "/bot/whatsapp/start";
      const status = await api.post<{
        status: "disconnected" | "connecting" | "connected";
        qrDataUrl?: string | null;
        pairingCode?: string | null;
        lastError?: string | null;
      }>(endpoint, token, {});
      setWaConnected(status.status === "connected");
      setWaConnecting(status.status === "connecting");
      setWaQrDataUrl(status.qrDataUrl ?? null);
      setWaPairingCode(status.pairingCode ?? null);
      setPollWhatsAppStatus(status.status === "connecting");
      setBotStatus(
        status.qrDataUrl
          ? "Scan QR WhatsApp di bawah untuk pairing Baileys."
          : status.lastError
            ? `WhatsApp: ${status.lastError}`
            : `WhatsApp: ${status.status}`,
      );
    } catch (error) {
      setBotStatus(
        error instanceof Error ? error.message : "WhatsApp gagal dihubungkan.",
      );
    }
  }

  async function handleWhatsAppPairing(e: React.FormEvent) {
    e.preventDefault();
    if (!token || token === "dev-fallback-token" || !phoneInput.trim()) {
      setBotStatus("Masukkan nomor telepon dan pastikan backend jalan.");
      return;
    }
    try {
      const result = await api.post<{
        status: string;
        pairingCode?: string | null;
        qrDataUrl?: string | null;
        lastError?: string | null;
      }>("/bot/whatsapp/pairing", token, { phone: phoneInput.trim() });
      setWaPairingCode(result.pairingCode ?? null);
      setWaQrDataUrl(result.qrDataUrl ?? null);
      setWaConnecting(result.status === "connecting");
      setPollWhatsAppStatus(result.status === "connecting");
      if (result.pairingCode) {
        setBotStatus(`Pairing code: ${result.pairingCode}`);
      } else if (result.qrDataUrl) {
        setBotStatus("Scan QR untuk pairing");
      } else {
        setBotStatus(result.lastError ?? "WhatsApp pairing dimulai...");
      }
    } catch (error) {
      setBotStatus(error instanceof Error ? error.message : "Pairing gagal.");
    }
  }

  async function handleTelegramConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token || token === "dev-fallback-token") {
      setBotStatus("Backend harus jalan untuk konfigurasi Telegram.");
      return;
    }
    if (!tgBotToken.trim()) {
      setBotStatus("Masukkan bot token dari BotFather.");
      return;
    }
    setTgConnecting(true);
    try {
      const result = await api.post<{
        ok: boolean;
        error?: string;
        username?: string;
      }>("/bot/telegram/config", token, {
        botToken: tgBotToken.trim(),
        chatId: tgChatId.trim(),
      });
      if (result.ok) {
        setTgConnected(true);
        setTelegramHandle(result.username ?? tgHandleFallback);
        setBotStatus(
          "Telegram berhasil dikonfigurasi! Gunakan tombol Test untuk kirim percobaan.",
        );
      } else {
        setBotStatus(result.error ?? "Telegram gagal dikonfigurasi.");
      }
    } catch (error) {
      setBotStatus(
        error instanceof Error ? error.message : "Telegram config gagal.",
      );
    } finally {
      setTgConnecting(false);
    }
  }

  async function handleTelegramTest() {
    if (!token || token === "dev-fallback-token") {
      setBotStatus("Backend harus jalan untuk test Telegram.");
      return;
    }
    try {
      const result = await api.post<{ ok: boolean; error?: string }>(
        "/bot/telegram/test",
        token,
        { text: `✅ ${appName} Telegram test` },
      );
      setBotStatus(
        result.ok
          ? "Telegram test terkirim."
          : (result.error ?? "Telegram test gagal."),
      );
    } catch (error) {
      setBotStatus(
        error instanceof Error ? error.message : "Telegram test gagal.",
      );
    }
  }

  async function handleAddPermission(
    contactId: string,
    contactName: string,
    channel: string,
  ) {
    if (!token || token === "dev-fallback-token") {
      setBotStatus("Backend harus jalan untuk mengelola permission.");
      return;
    }
    try {
      const result = await api.post<BotPermissionItem>(
        "/bot/permissions",
        token,
        {
          contactId,
          contactName: contactName || contactId,
          channel,
        },
      );
      setPermissions((prev) => [result, ...prev]);
      setShowAddPermission(false);
      setSearchQuery("");
      setBotStatus(
        `✅ Kontak ${contactName || contactId} ditambahkan ke izin akses.`,
      );
    } catch (error) {
      setBotStatus(
        error instanceof Error ? error.message : "Gagal menambah permission.",
      );
    }
  }

  async function handleRemovePermission(permissionId: string) {
    if (!token || token === "dev-fallback-token") return;
    try {
      await api.delete(`/bot/permissions/${permissionId}`, token);
      setPermissions((prev) => prev.filter((p) => p.id !== permissionId));
      setBotStatus("✅ Kontak dihapus dari izin akses.");
    } catch (error) {
      setBotStatus(
        error instanceof Error ? error.message : "Gagal menghapus permission.",
      );
    }
  }

  function openOcr() {
    setShowOcrModal(true);
    setOcrAnalyzing(false);
    setOcrDone(false);
    setOcrResult(null);
  }

  return (
    <PageWrapper
      title="AI Bot"
      subtitle="Catat transaksi otomatis via WhatsApp & Telegram"
    >
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {/* ── Left column: Setup ─────────────────────────────────── */}
        <div className="space-y-5">
          {/* WhatsApp Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-xl select-none">
                  💬
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-text-primary font-semibold">
                      WhatsApp Bot
                    </h3>
                    <Badge variant="success" size="sm">
                      Beta
                    </Badge>
                  </div>
                  <p className="text-text-muted mt-0.5 text-xs">
                    Catat via pesan WhatsApp
                  </p>
                </div>
              </div>
              {waConnected ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  Terhubung
                </Badge>
              ) : waConnecting ? (
                <Badge variant="warning">
                  <MessageCircle className="h-3 w-3" />
                  Pairing
                </Badge>
              ) : (
                <Badge variant="default">
                  <XCircle className="h-3 w-3" />
                  Belum Terhubung
                </Badge>
              )}
            </CardHeader>

            <CardBody className="space-y-4">
              <p className="text-text-secondary text-sm">
                Catat transaksi otomatis hanya dengan mengirim pesan ke nomor
                WhatsApp {appName}.
              </p>

              {waConnected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="border-success/20 bg-success/5 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-6 py-6"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
                    <Phone className="text-success h-7 w-7" />
                  </div>
                  <span className="text-success mt-2 text-lg font-bold">
                    WhatsApp Terhubung
                  </span>
                  {waPhone && (
                    <span className="text-text-secondary mt-1 text-2xl font-bold tracking-wider">
                      {waPhone}
                    </span>
                  )}
                  <span className="text-text-muted mt-1 text-xs">
                    Aktif — kirim pesan ke nomor ini untuk catat transaksi
                  </span>
                </motion.div>
              )}

              {waConnecting && !waConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="border-warning/20 bg-warning/10 flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2.5"
                >
                  <MessageCircle className="text-warning h-4 w-4 shrink-0" />
                  <span className="text-warning text-sm font-medium">
                    {waQrDataUrl
                      ? "Menunggu scan QR WhatsApp"
                      : waPairingCode
                        ? "Menunggu konfirmasi pairing code"
                        : "Mengecek status WhatsApp..."}
                  </span>
                </motion.div>
              )}

              {waQrDataUrl && (
                <div className="border-border rounded-xl border bg-white p-3">
                  <img
                    src={waQrDataUrl}
                    alt="QR Pairing WhatsApp"
                    className="mx-auto h-56 w-56"
                  />
                  <p className="mt-2 text-center text-xs text-gray-600">
                    WhatsApp → Linked devices → Link a device
                  </p>
                </div>
              )}

              {waPairingCode && (
                <div className="border-primary/30 bg-primary/5 rounded-xl border p-4 text-center">
                  <p className="text-text-muted mb-2 text-xs">
                    Pairing Code (masukkan di WhatsApp → Perangkat tertaut →
                    Tautkan perangkat)
                  </p>
                  <p className="text-primary font-mono text-2xl font-bold tracking-widest">
                    {waPairingCode}
                  </p>
                </div>
              )}

              {/* Error display with reset button */}
              {!waConnected &&
                !waConnecting &&
                botStatus &&
                botStatus.includes("WhatsApp:") &&
                botStatus !== "WhatsApp: connected" && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary text-sm font-medium">
                          Koneksi Bermasalah
                        </p>
                        <p className="text-text-muted mt-1 text-xs break-words">
                          {botStatus}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStartWhatsApp}
                          >
                            Coba Lagi
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            style={{ borderColor: "#dc2626", color: "#dc2626" }}
                            onClick={handleResetSession}
                          >
                            Reset Sesi
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-red-500/10 pt-3">
                      <p className="text-text-muted text-xs">
                        💡 <strong>Saran:</strong> Klik "Reset Sesi" untuk
                        menghapus sesi WhatsApp yang mungkin korup, lalu
                        hubungkan ulang dengan QR atau Pairing Code.
                      </p>
                    </div>
                  </div>
                )}

              {!waConnected && (
                <>
                  {/* Pairing Code Form */}
                  <form onSubmit={handleWhatsAppPairing} className="flex gap-2">
                    <input
                      type="tel"
                      placeholder="Nomor telepon (cth. 628123456789)"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                      disabled={waConnecting}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={waConnecting}
                    >
                      {waConnecting ? "Memproses..." : "Pairing Code"}
                    </Button>
                  </form>

                  {!waConnecting && (
                    <Button
                      className="w-full"
                      style={{ background: "#16a34a" }}
                      onClick={handleStartWhatsApp}
                    >
                      Hubungkan WhatsApp (QR)
                    </Button>
                  )}
                </>
              )}

              {waConnected && (
                <Button
                  className="w-full"
                  style={{ background: "#dc2626" }}
                  onClick={handleStartWhatsApp}
                >
                  Putuskan WhatsApp
                </Button>
              )}

              {/* Collapsible commands */}
              <button
                onClick={() => setShowCommands((v) => !v)}
                className="text-text-secondary hover:text-text-primary flex w-full items-center justify-between text-sm font-medium transition-colors"
              >
                <span>Perintah yang Didukung</span>
                {showCommands ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              <AnimatePresence initial={false}>
                {showCommands && (
                  <motion.div
                    key="commands"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pb-1">
                      {WA_COMMANDS.map((c) => (
                        <div
                          key={c.cmd}
                          className="bg-bg-elevated flex items-start justify-between gap-4 rounded-lg px-3 py-2"
                        >
                          <code className="text-primary shrink-0 font-mono text-xs">
                            {c.cmd}
                          </code>
                          <span className="text-text-muted text-right text-xs">
                            {c.desc}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardBody>
          </Card>

          {/* Telegram Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl select-none"
                  style={{
                    background: "rgba(34,158,217,0.15)",
                    color: "#229ED9",
                  }}
                >
                  ✈️
                </div>
                <div>
                  <h3 className="text-text-primary font-semibold">
                    Telegram Bot
                  </h3>
                  <p className="text-text-muted mt-0.5 text-xs">
                    Catat via bot Telegram
                  </p>
                </div>
              </div>
              {tgConnected ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  Terhubung
                </Badge>
              ) : (
                <Badge variant="default">
                  <XCircle className="h-3 w-3" />
                  Belum Terhubung
                </Badge>
              )}
            </CardHeader>

            <CardBody className="space-y-4">
              <p className="text-text-secondary text-sm">
                Gunakan bot Telegram untuk mencatat transaksi dengan perintah
                sederhana kapan saja.
              </p>

              {tgConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-2 overflow-hidden rounded-lg border px-3 py-2.5"
                  style={{
                    background: "rgba(34,158,217,0.1)",
                    borderColor: "rgba(34,158,217,0.25)",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#229ED9" }}
                  >
                    {telegramHandle}
                  </span>
                </motion.div>
              )}

              {/* Telegram Config Form */}
              <form onSubmit={handleTelegramConnect} className="space-y-3">
                <input
                  type="text"
                  placeholder="Bot Token dari BotFather (cth. 123456:ABC-DEF)"
                  value={tgBotToken}
                  onChange={(e) => setTgBotToken(e.target.value)}
                  className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Chat ID (opsional, untuk test)"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    loading={tgConnecting}
                  >
                    {tgConnected ? "Update Token" : "Connect Bot"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={handleTelegramTest}
                    disabled={!tgConnected}
                  >
                    Test
                  </Button>
                </div>
              </form>

              <p className="text-text-muted text-xs">
                1. Buat bot di @BotFather dan dapatkan token 2. Dapatkan Chat ID
                dengan kirim pesan ke bot lalu visit:
                <code className="bg-bg-elevated mx-1 rounded px-1 font-mono">
                  https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                </code>
              </p>
            </CardBody>
          </Card>

          {/* OCR Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="bg-warning/15 text-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-text-primary font-semibold">
                    Scan Nota / Struk
                  </h3>
                  <p className="text-text-muted mt-0.5 text-xs">
                    OCR otomatis via foto
                  </p>
                </div>
              </div>
              <Badge variant="success">95% Akurasi</Badge>
            </CardHeader>

            <CardBody className="space-y-4">
              <p className="text-text-secondary text-sm">
                Kirim foto struk belanjaan ke bot, AI akan otomatis mengekstrak
                total dan item belanjaan.
              </p>

              <div className="space-y-2">
                <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
                  Toko yang Didukung
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_STORES.map((s) => (
                    <div
                      key={s.name}
                      className="bg-bg-elevated text-text-secondary flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm"
                    >
                      <span>{s.emoji}</span>
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                leftIcon={<Camera className="h-4 w-4" />}
                onClick={openOcr}
              >
                Coba Demo OCR
              </Button>
            </CardBody>
          </Card>

          {/* ── Bot Permissions Card ──────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-text-primary font-semibold">
                    Kontak yang Diizinkan
                  </h3>
                  <p className="text-text-muted mt-0.5 text-xs">
                    Nomor yang bisa menggunakan AI Bot
                  </p>
                </div>
              </div>
              {permissions.length > 0 ? (
                <Badge variant="success" size="sm">
                  {permissions.length}
                </Badge>
              ) : (
                <Badge variant="default" size="sm">
                  0
                </Badge>
              )}
            </CardHeader>

            <CardBody className="space-y-3">
              <p className="text-text-secondary text-sm">
                Hanya kontak yang diizinkan yang bisa menggunakan bot
                WhatsApp/Telegram. Kontak lain akan diabaikan secara otomatis.
              </p>

              {permissions.length === 0 ? (
                <div className="bg-bg-elevated rounded-lg px-4 py-6 text-center">
                  <p className="text-text-muted text-sm">
                    Belum ada kontak yang diizinkan.
                  </p>
                  <p className="text-text-muted mt-1 text-xs">
                    Tambahkan kontak dari WhatsApp atau Telegram yang terhubung.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="bg-bg-elevated flex items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-text-primary truncate text-sm font-medium">
                          {perm.contactName || perm.contactId}
                        </p>
                        <p className="text-text-muted flex items-center gap-1.5 text-xs">
                          <span>
                            {perm.channel === "whatsapp" ? "💬" : "✈️"}
                          </span>
                          <span className="font-mono">{perm.contactId}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => void handleRemovePermission(perm.id)}
                        className="text-text-muted shrink-0 rounded-lg p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        title="Hapus izin"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                leftIcon={<Phone className="h-4 w-4" />}
                onClick={() => setShowAddPermission(true)}
                disabled={!token || token === "dev-fallback-token"}
              >
                Tambah Kontak
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* ── Right column: Live Chat Demo ──────────────────────── */}
        <div className="xl:sticky xl:top-6">
          <Card padding="none" className="flex h-170 flex-col overflow-hidden">
            {/* Chat header */}
            <div className="border-border bg-bg-elevated flex shrink-0 items-center gap-3 border-b px-4 py-3">
              <div className="bg-primary/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl select-none">
                🤖
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-semibold">
                  {appName} Bot
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <motion.span
                    className="bg-success h-2 w-2 rounded-full"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut",
                    }}
                  />
                  <span className="text-text-muted text-xs">Online</span>
                </div>
              </div>
              <MessageCircle className="text-text-muted h-5 w-5 shrink-0" />
            </div>

            {/* Messages area */}
            <div
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ background: "var(--bg-base)" }}
            >
              {liveMessages.map((msg, i) => (
                <ChatBubble key={msg.id} msg={msg} index={i} />
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="border-border bg-bg-elevated flex shrink-0 items-center gap-2 border-t px-3 py-2.5">
              <button
                className="text-text-muted hover:bg-bg-base flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
                type="button"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSendChat();
                }}
                placeholder="Coba: beli kopi 25rb pakai kantong jajan"
                className="border-border bg-bg-base text-text-primary placeholder:text-text-muted focus:border-primary/60 h-9 flex-1 rounded-full border px-4 text-sm outline-none"
              />
              <button
                className="bg-primary/20 text-primary hover:bg-primary/30 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60"
                type="button"
                disabled={sendingChat}
                onClick={() => void handleSendChat()}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <p className="border-border bg-bg-surface text-text-muted shrink-0 border-t py-2 text-center text-[11px]">
              {botStatus ??
                "💡 Input aktif — backend bot akan dipakai jika server berjalan"}
            </p>
          </Card>
        </div>
      </div>

      {/* ── OCR Demo Modal ───────────────────────────────────────── */}
      <Modal
        open={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        title="Demo OCR Struk"
        description="Simulasi analisis struk belanjaan menggunakan AI"
        size="md"
      >
        <div className="space-y-4">
          {/* Styled mock receipt */}
          <div className="border-border overflow-hidden rounded-xl border shadow-sm">
            <div className="bg-white p-5 font-mono text-black">
              <p className="mb-1 text-center text-base font-bold tracking-wide">
                ALFAMART
              </p>
              <p className="mb-0.5 text-center text-[11px] text-gray-500">
                Jl. Sudirman No. 12, Jakarta
              </p>
              <p className="mb-3 text-center text-[11px] text-gray-500">
                07/06/2026 — 10:11 WIB
              </p>
              <div className="border-t border-dashed border-gray-300 pt-2.5">
                <div className="space-y-1.5">
                  {OCR_ITEMS.map((item) => (
                    <div
                      key={item.name}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-gray-700">{item.name}</span>
                      <span className="font-medium">{item.price}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex justify-between border-t border-dashed border-gray-300 pt-2 text-sm font-bold">
                  <span>TOTAL</span>
                  <span>Rp19.250</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-600">
                  <span>TUNAI</span>
                  <span>Rp20.000</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>KEMBALI</span>
                  <span>Rp750</span>
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-gray-400">
                — Terima kasih telah berbelanja! —
              </p>
            </div>
          </div>

          <Button
            className="w-full"
            loading={ocrAnalyzing}
            leftIcon={!ocrAnalyzing ? <Bot className="h-4 w-4" /> : undefined}
            onClick={handleAnalyzeOcr}
          >
            {ocrAnalyzing ? "Menganalisis..." : "Analisis Struk"}
          </Button>

          <AnimatePresence>
            {ocrDone && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="border-success/30 bg-success/5 space-y-3 rounded-xl border p-4"
              >
                <div className="text-success flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold">
                    Struk Berhasil Dianalisis!
                  </span>
                </div>

                <div className="space-y-2">
                  {displayedOcrItems.map((item) => (
                    <div
                      key={item.name}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-text-secondary">• {item.name}</span>
                      <span className="text-text-primary font-medium">
                        {item.price}
                      </span>
                    </div>
                  ))}
                  <div className="border-border flex justify-between border-t pt-2 text-sm font-semibold">
                    <span className="text-text-primary">Total</span>
                    <span className="text-success">{displayedOcrTotal}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-bg-elevated rounded-lg p-2.5 text-center">
                    <p className="text-text-muted text-[11px]">Kategori</p>
                    <p className="text-text-primary mt-0.5 text-sm font-medium">
                      🛒 {displayedOcrCategory}
                    </p>
                  </div>
                  <div className="bg-bg-elevated rounded-lg p-2.5 text-center">
                    <p className="text-text-muted text-[11px]">Dompet</p>
                    <p className="text-text-primary mt-0.5 text-sm font-medium">
                      🍔 {displayedOcrWallet}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Modal>

      {/* ── Add Permission Modal ──────────────────────────────────── */}
      <Modal
        open={showAddPermission}
        onClose={() => {
          setShowAddPermission(false);
          setSearchQuery("");
        }}
        title="Tambah Kontak"
        description="Pilih kontak yang diizinkan menggunakan AI Bot"
        size="md"
      >
        <div className="space-y-4">
          {/* Tab selector */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                permissionTab === "whatsapp"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
              onClick={() => setPermissionTab("whatsapp")}
            >
              💬 WhatsApp ({waContacts.length})
            </button>
            <button
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                permissionTab === "telegram"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
              onClick={() => setPermissionTab("telegram")}
            >
              ✈️ Telegram ({tgContacts.length})
            </button>
          </div>

          {/* Search input */}
          <input
            type="text"
            placeholder="Cari kontak..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-bg-surface border-border text-text-primary placeholder:text-text-muted focus:ring-primary/50 h-10 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
          />

          {/* Contact list */}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(permissionTab === "whatsapp" ? waContacts : tgContacts)
              .filter((c) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  c.name.toLowerCase().includes(q) ||
                  (c.phone || c.chatId || "").includes(q)
                );
              })
              .map((contact) => {
                const contactId =
                  contact.phone || contact.chatId || contact.jid || "";
                const alreadyAdded = permissions.some(
                  (p) =>
                    p.contactId === contactId && p.channel === permissionTab,
                );
                return (
                  <div
                    key={contactId}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-colors ${
                      alreadyAdded
                        ? "bg-success/5 opacity-50"
                        : "bg-bg-elevated hover:bg-bg-surface cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!alreadyAdded) {
                        void handleAddPermission(
                          contactId,
                          contact.name,
                          permissionTab,
                        );
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary truncate text-sm font-medium">
                        {contact.name || contactId}
                      </p>
                      <p className="text-text-muted font-mono text-xs">
                        {contact.phone || contact.chatId || contactId}
                      </p>
                    </div>
                    {alreadyAdded ? (
                      <Badge variant="success" size="sm">
                        Sudah
                      </Badge>
                    ) : (
                      <span className="text-primary text-sm font-medium">
                        Tambah
                      </span>
                    )}
                  </div>
                );
              })}
            {(permissionTab === "whatsapp" ? waContacts : tgContacts).filter(
              (c) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  c.name.toLowerCase().includes(q) ||
                  (c.phone || c.chatId || "").includes(q)
                );
              },
            ).length === 0 && (
              <div className="py-6 text-center">
                <p className="text-text-muted text-sm">
                  {searchQuery
                    ? "Tidak ada kontak yang cocok."
                    : `Belum ada kontak ${permissionTab === "whatsapp" ? "WhatsApp" : "Telegram"}.\nKirim pesan ke bot dulu untuk memunculkan kontak.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
