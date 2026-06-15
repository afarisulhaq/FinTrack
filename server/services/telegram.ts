import { parseFinanceText } from "./ai-parser";

const TELEGRAM_API = "https://api.telegram.org";

// In-memory store of known Telegram contacts (chatId -> name)
// Populated from incoming updates
const knownTelegramContacts = new Map<string, string>();

export function getTelegramContacts(): Array<{ chatId: string; name: string }> {
  const contacts: Array<{ chatId: string; name: string }> = [];
  for (const [chatId, name] of knownTelegramContacts.entries()) {
    contacts.push({ chatId, name });
  }
  contacts.sort((a, b) => a.name.localeCompare(b.name));
  return contacts;
}

function getTelegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramMessage(
  text: string,
  chatId: string | undefined = process.env.TELEGRAM_DEFAULT_CHAT_ID,
  botToken?: string,
) {
  const token = botToken || getTelegramToken();
  if (!token)
    return {
      ok: false,
      error: "TELEGRAM_BOT_TOKEN belum diisi dari BotFather",
    };
  if (!chatId)
    return { ok: false, error: "Chat ID belum diisi" };

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = (await response.json()) as unknown;
    return { ok: response.ok, data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Telegram request gagal",
    };
  }
}

export async function getTelegramMe(botToken?: string) {
  const token = botToken || getTelegramToken();
  if (!token) return null;
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
    const data = (await response.json()) as {
      ok?: boolean;
      result?: { username?: string; first_name?: string; id?: number };
    };
    return data.ok ? (data.result ?? null) : null;
  } catch {
    return null;
  }
}

export async function verifyTelegramToken(botToken: string) {
  if (!botToken || !/^\d+:\S+$/.test(botToken))
    return { ok: false, error: "Format token tidak valid" };
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
    if (!response.ok) return { ok: false, error: "Token tidak valid atau bot tidak ditemukan" };
    const data = (await response.json()) as {
      ok?: boolean;
      result?: { username?: string; first_name?: string; id?: number };
    };
    if (!data.ok || !data.result) {
      return { ok: false, error: "Token tidak valid" };
    }
    return {
      ok: true,
      username: data.result.username ? `@${data.result.username}` : null,
      name: data.result.first_name ?? null,
      botId: data.result.id ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal verifikasi token",
    };
  }
}

export async function handleTelegramUpdate(update: {
  message?: {
    from?: { first_name?: string; last_name?: string; username?: string };
    chat?: { id?: number | string };
    text?: string;
  };
}) {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text ?? "";
  if (!chatId || !text.trim()) return { ok: false, ignored: true };

  // Track this contact
  const from = update.message?.from;
  const name = from?.first_name
    ? [from.first_name, from.last_name].filter(Boolean).join(" ")
    : from?.username ?? String(chatId);
  const chatIdStr = String(chatId);
  if (!knownTelegramContacts.has(chatIdStr)) {
    knownTelegramContacts.set(chatIdStr, name);
  }

  // TODO: Permission check for Telegram
  // Need to know which user's bot token received this update to check BotPermission

  if (text.trim() === "/start") {
    return sendTelegramMessage(
      "Halo! Kirim pesan seperti: beli kopi 25rb pakai kantong jajan",
      chatIdStr,
    );
  }

  const parsed = parseFinanceText(text);
  return sendTelegramMessage(parsed.reply, chatIdStr);
}

export async function telegramStatus(botToken?: string) {
  const bot = await getTelegramMe(botToken);
  return {
    configured: Boolean(botToken || process.env.TELEGRAM_BOT_TOKEN),
    defaultChatConfigured: Boolean(process.env.TELEGRAM_DEFAULT_CHAT_ID),
    username: bot?.username ? `@${bot.username}` : null,
    name: bot?.first_name ?? null,
  };
}
