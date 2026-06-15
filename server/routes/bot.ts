import { Elysia } from "elysia";
import { requireAuth } from "../auth-middleware.js";
import { extractToken, verifyToken } from "../auth.js";
import { canUseDatabase, db as prisma } from "../prisma-client.js";
import { fail, ok } from "../utils.js";
import { mockOcrReceipt, parseFinanceText } from "../services/ai-parser.js";
import {
  handleTelegramUpdate,
  sendTelegramMessage,
  telegramStatus,
  verifyTelegramToken,
  getTelegramContacts,
} from "../services/telegram.js";
import {
  resetWhatsAppSession,
  sendWhatsAppMessage,
  setWhatsAppConnectedUser,
  startWhatsAppBot,
  startWhatsAppBotWithPairing,
  stopWhatsAppBot,
  whatsappStatus,
  getWhatsAppContacts,
} from "../services/whatsapp.js";

function getUserIdFromRequest(request: Request): string | null {
  const token = extractToken(
    request.headers.get("authorization") ?? undefined,
  );
  const auth = token ? verifyToken(token) : null;
  return auth?.sub ?? null;
}

async function getUserTelegramConfig(userId: string | null) {
  if (!userId || !(await canUseDatabase())) return null;
  try {
    const setting = await prisma.notificationSetting.findUnique({
      where: { userId },
    });
    if (!setting || !setting.channelTGBot) return null;
    return {
      botToken: setting.channelTGBot,
      chatId: setting.channelTGChatId,
    };
  } catch {
    return null;
  }
}

async function saveBotConnection(
  channel: "whatsapp" | "telegram",
  status: string,
  enabled: boolean,
  meta?: Record<string, unknown>,
) {
  if (!(await canUseDatabase())) return;

  try {
    await prisma.botConnection.upsert({
      where: { channel },
      update: { status, enabled, meta: meta as never },
      create: {
        channel,
        status,
        enabled,
        meta: meta as never,
      },
    });
  } catch (error) {
    console.warn(
      "BotConnection table unavailable, skipping bot status persistence:",
      error instanceof Error ? error.message : error,
    );
  }
}

export const botRoutes = new Elysia({ prefix: "/api/bot" })
  .post("/telegram/webhook", async ({ body }) => {
    const result = await handleTelegramUpdate(body as never);
    return ok(result);
  })
  .use(requireAuth)
  .get("/status", async ({ request }) => {
    const whatsapp = whatsappStatus();

    // Get user-specific telegram config
    const userId = getUserIdFromRequest(request);
    const userConfig = await getUserTelegramConfig(userId);
    const telegram = userConfig
      ? await telegramStatus(userConfig.botToken)
      : await telegramStatus();

    if (await canUseDatabase()) {
      await Promise.all([
        saveBotConnection(
          "whatsapp",
          whatsapp.status,
          whatsapp.status === "connected",
          {
            qrReady: Boolean(whatsapp.qrDataUrl),
            lastError: whatsapp.lastError,
            pairingCode: whatsapp.pairingCode,
          },
        ),
        saveBotConnection(
          "telegram",
          telegram.configured ? "configured" : "unconfigured",
          Boolean(telegram.configured),
          {
            username: telegram.username,
            name: telegram.name,
            chatConfigured: telegram.defaultChatConfigured,
          },
        ),
      ]);
    }

    // Get user's WhatsApp phone from notification settings
    let waPhone: string | null = null;
    if (userId && (await canUseDatabase())) {
      try {
        const notif = await prisma.notificationSetting.findUnique({
          where: { userId },
        });
        waPhone = notif?.channelPhone ?? null;
      } catch { /* ignore */ }
    }

    return ok({
      whatsapp: {
        status: whatsapp.status,
        qrDataUrl: whatsapp.qrDataUrl,
        pairingCode: whatsapp.pairingCode,
        lastError: whatsapp.lastError,
        phone: waPhone || whatsapp.phone || null,
      },
      telegram,
      telegramUserConfig: {
        configured: Boolean(userConfig?.botToken),
        botToken: userConfig?.botToken ? "***" : null,
        chatId: userConfig?.chatId ? userConfig.chatId.slice(0, 4) + "***" : null,
      },
    });
  })
  .post("/whatsapp/start", async ({ request }) => {
      const userId = getUserIdFromRequest(request);
      if (userId) {
        setWhatsAppConnectedUser(userId);
        // Save channelWA flag so auto-reconnect can find this user
        if (await canUseDatabase()) {
          try {
            await prisma.notificationSetting.upsert({
              where: { userId },
              update: { channelWA: true },
              create: { userId, channelWA: true },
            });
          } catch { /* ignore */ }
        }
      }
      const status = await startWhatsAppBot();
      return ok(status);
    })
  .post("/whatsapp/stop", async () => {
    setWhatsAppConnectedUser(null);
    const status = await stopWhatsAppBot();
    return ok(status);
  })
  .post("/whatsapp/reset", async () => {
    const result = await resetWhatsAppSession();
    return ok(result);
  })
  .post("/telegram/test", async ({ request, body, set }) => {
    const data = body as { text?: string } | null;
    if (!data?.text) {
      set.status = 400;
      return fail("Text wajib diisi");
    }
    // Try user's own token first, fall back to env var
    const userId = getUserIdFromRequest(request);
    const userConfig = await getUserTelegramConfig(userId);
    const result = await sendTelegramMessage(
      data.text,
      userConfig?.chatId ?? process.env.TELEGRAM_DEFAULT_CHAT_ID,
      userConfig?.botToken,
    );
    return ok(result);
  })
  .post("/whatsapp/test", async ({ body, set }) => {
    const data = body as { phone?: string; text?: string } | null;
    if (!data?.phone || !data.text) {
      set.status = 400;
      return fail("Nomor dan pesan wajib diisi");
    }
    const result = await sendWhatsAppMessage(data.phone, data.text);
    return ok(result);
  })
  .post("/chat", async ({ request, body }) => {
    const data = body as { message?: string } | null;
    if (!data?.message) return ok({ reply: "Teks kosong" });

    const message = data.message.trim();
    const userId = getUserIdFromRequest(request);
    const lower = message.toLowerCase();

    // Handle /saldo command
    if (lower === "/saldo" && userId && (await canUseDatabase())) {
      try {
        const wallets = await prisma.wallet.findMany({ where: { userId } });
        if (wallets.length === 0) return ok({ reply: "Belum ada dompet." });
        const lines = wallets.map(
          (w) => `👛 ${w.name}: Rp${Number(w.balance).toLocaleString("id-ID")}`,
        );
        return ok({ reply: `💰 *Saldo Dompet*\n\n${lines.join("\n")}` });
      } catch { /* fall through */ }
    }

    // Handle /laporan command
    if (lower === "/laporan" && userId && (await canUseDatabase())) {
      try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const expenses = await prisma.transaction.findMany({
          where: { userId, type: "expense", date: { gte: startOfWeek } },
        });
        if (expenses.length === 0) return ok({ reply: "📊 Belum ada transaksi minggu ini." });

        const total = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const topCategory = expenses.reduce<Record<string, number>>((acc, tx) => {
          acc[tx.category] = (acc[tx.category] ?? 0) + Number(tx.amount);
          return acc;
        }, {});
        const top = Object.entries(topCategory).sort((a, b) => b[1] - a[1])[0];

        return ok({
          reply: [
            `📊 *Laporan Minggu Ini*`,
            `Total: Rp${total.toLocaleString("id-ID")}`,
            `Transaksi: ${expenses.length}`,
            top ? `Terbanyak: ${top[0]} (Rp${top[1].toLocaleString("id-ID")})` : "",
          ].join("\n"),
        });
      } catch { /* fall through */ }
    }

    // Try to save transaction if amount is detected
    const parsed = parseFinanceText(message);
    if (parsed.amount > 0 && userId && (await canUseDatabase())) {
      try {
        const wallets = await prisma.wallet.findMany({ where: { userId } });
        // Smart wallet matching (same logic as findBestWallet in whatsapp.ts)
        const findWallet = (name: string) => {
          const lower = name.toLowerCase().replace(/^dompet\s+/i, "");
          if (!wallets.length) return null;
          const exact = wallets.find((w) => w.name.toLowerCase() === lower);
          if (exact) return exact;
          const noPrefix = wallets.find(
            (w) => w.name.toLowerCase().replace(/^dompet\s+/i, "") === lower,
          );
          if (noPrefix) return noPrefix;
          const startsWith = wallets.find((w) => w.name.toLowerCase().startsWith(lower));
          if (startsWith) return startsWith;
          const sorted = [...wallets].sort((a, b) => a.name.length - b.name.length);
          const includes = sorted.find((w) => lower.includes(w.name.toLowerCase()));
          if (includes) return includes;
          const contained = sorted.find((w) => w.name.toLowerCase().includes(lower));
          if (contained) return contained;
          return null;
        };
        const wallet = findWallet(parsed.wallet) ?? wallets[0];

        if (wallet) {
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

          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              balance:
                parsed.type === "income"
                  ? { increment: parsed.amount }
                  : { decrement: parsed.amount },
            },
          });

          const formattedAmount = `Rp${parsed.amount.toLocaleString("id-ID")}`;
          return ok({
            reply: `✅ *Transaksi Berhasil Dicatat!*\n💸 Pengeluaran: ${formattedAmount}\n📂 Kategori: ${parsed.category}\n👛 Dompet: ${wallet.name}\n📝 ${parsed.description}`,
            saved: true,
          });
        }
      } catch (err) {
        console.warn("Chat transaction save failed:", err);
      }
    }

    return ok(parsed);
  })
  .post("/whatsapp/config", async ({ request, body, set }) => {
    const data = body as { phone?: string; enable?: boolean } | null;
    if (!data?.phone) {
      set.status = 400;
      return fail("Nomor telepon wajib diisi");
    }
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      set.status = 401;
      return fail("Unauthorized");
    }

    // Save phone number to user's notification settings
    if (await canUseDatabase()) {
      const existing = await prisma.notificationSetting.findUnique({
        where: { userId },
      });
      if (existing) {
        await prisma.notificationSetting.update({
          where: { userId },
          data: {
            channelWA: data.enable ?? true,
            channelPhone: data.phone,
          },
        });
      } else {
        await prisma.notificationSetting.create({
          data: {
            userId,
            channelWA: data.enable ?? true,
            channelPhone: data.phone,
          },
        });
      }
    }

    return ok({ saved: true, phone: data.phone });
  })
  .post("/whatsapp/pairing", async ({ request, body, set }) => {
    const data = body as { phone?: string } | null;
    if (!data?.phone) {
      set.status = 400;
      return fail("Nomor telepon wajib diisi");
    }

    // Save phone to user's notification settings
    const userId = getUserIdFromRequest(request);
    if (userId) setWhatsAppConnectedUser(userId);

    if (userId && (await canUseDatabase())) {
      try {
        const existing = await prisma.notificationSetting.findUnique({
          where: { userId },
        });
        if (existing) {
          await prisma.notificationSetting.update({
            where: { userId },
            data: { channelWA: true, channelPhone: data.phone },
          });
        } else {
          await prisma.notificationSetting.create({
            data: { userId, channelWA: true, channelPhone: data.phone },
          });
        }
      } catch (err) {
        console.warn("Failed to save phone to notification settings:", err);
      }
    }

    const status = await startWhatsAppBotWithPairing(data.phone);
    return ok(status);
  })
  .post("/telegram/config", async ({ request, body, set }) => {
    const data = body as { botToken?: string; chatId?: string } | null;
    if (!data?.botToken) {
      set.status = 400;
      return fail("Bot token wajib diisi");
    }
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      set.status = 401;
      return fail("Unauthorized");
    }

    // Verify the token
    const verified = await verifyTelegramToken(data.botToken);
    if (!verified.ok) {
      set.status = 400;
      return ok(verified);
    }

    // Save to user's notification settings
    if (await canUseDatabase()) {
      const existing = await prisma.notificationSetting.findUnique({
        where: { userId },
      });
      const updateData = {
        channelTG: true,
        channelTGBot: data.botToken,
        channelTGChatId: data.chatId ?? "",
      };
      if (existing) {
        await prisma.notificationSetting.update({
          where: { userId },
          data: updateData as never,
        });
      } else {
        await prisma.notificationSetting.create({
          data: { ...updateData, userId } as never,
        });
      }
    }

    return ok(verified);
  })
  .post("/ocr-demo", async () => ok(mockOcrReceipt()))
  .post("/ai/parse", async ({ body }) => {
    const data = body as { text?: string } | null;
    if (!data?.text) return ok({ reply: "Teks kosong" });
    return ok(parseFinanceText(data.text));
  })
  .post("/ai/ocr", async () => ok(mockOcrReceipt()))

  // ─── Bot Permissions ─────────────────────────────────────
  .get("/permissions", async ({ request }) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) return ok([]);
    if (!(await canUseDatabase())) return ok([]);
    try {
      const permissions = await prisma.botPermission.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return ok(permissions);
    } catch { return ok([]); }
  })
  .post("/permissions", async ({ request, body, set }) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) { set.status = 401; return fail("Unauthorized"); }
    const data = body as { contactId?: string; contactName?: string; channel?: string } | null;
    if (!data?.contactId || !data?.channel) {
      set.status = 400;
      return fail("contactId dan channel wajib diisi");
    }
    if (!(await canUseDatabase())) { set.status = 503; return fail("Database tidak tersedia"); }
    try {
      const created = await prisma.botPermission.create({
        data: {
          userId,
          channel: data.channel,
          contactId: data.contactId,
          contactName: data.contactName ?? "",
        },
      });
      return ok(created);
    } catch (err) {
      set.status = 500;
      return fail(err instanceof Error ? err.message : "Gagal menyimpan permission");
    }
  })
  .delete("/permissions/:id", async ({ request, params, set }) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) { set.status = 401; return fail("Unauthorized"); }
    if (!(await canUseDatabase())) { set.status = 503; return fail("Database tidak tersedia"); }
    try {
      await prisma.botPermission.deleteMany({
        where: { id: params.id, userId },
      });
      return ok({ deleted: true });
    } catch (err) {
      set.status = 500;
      return fail(err instanceof Error ? err.message : "Gagal menghapus permission");
    }
  })
  .get("/contacts", async ({ request }) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) return ok({ whatsapp: [], telegram: [] });
    const waContacts = getWhatsAppContacts();
    const tgContacts = getTelegramContacts();
    return ok({
      whatsapp: waContacts,
      telegram: tgContacts,
    });
  });
