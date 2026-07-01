/**
 * Push notification routes + helpers.
 *
 * VAPID keys are read from env vars VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 * If not set, a keypair is generated on first boot and logged to console
 * so the deployer can persist them in .env.
 *
 * ponytail: subscriptions are in-memory; move to PushSubscription table
 * when user count exceeds single-server.
 */

import crypto from "crypto";
import { Elysia } from "elysia";
import { extractToken, verifyToken } from "../auth.js";
import { fail, ok } from "../utils.js";

// ── VAPID Key Management ────────────────────────────────────────────────────

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey("base64url") as string,
    privateKey: ecdh.getPrivateKey("base64url") as string,
  };
}

let vapidKeys: VapidKeys;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  };
} else {
  vapidKeys = generateVapidKeys();
  console.log("[Push] Generated VAPID keys (add to .env to persist):");
  console.log(`  VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`  VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
}

// ── Subscription Storage ────────────────────────────────────────────────────
// ponytail: in-memory map; migrate to DB PushSubscription table for multi-server

interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** userId → list of subscriptions (user can have multiple devices). */
const subscriptions = new Map<string, PushSub[]>();

function userIdFromRequest(request: Request): string | null {
  const token = extractToken(request.headers.get("authorization") ?? undefined);
  const auth = token ? verifyToken(token) : null;
  return auth?.sub ?? null;
}

// ── Web Push Sending ────────────────────────────────────────────────────────

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const hmac = crypto.createHmac("sha256", prk);
  hmac.update(Buffer.concat([info, Buffer.from([1])]));
  return hmac.digest().subarray(0, length);
}

/**
 * Create a signed VAPID JWT for the push endpoint's origin (RFC 8292).
 */
function createVapidJwt(audience: string): string {
  const header = Buffer.from(
    JSON.stringify({ typ: "JWT", alg: "ES256" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub: "mailto:admin@fintrack.app",
    }),
  ).toString("base64url");

  const unsigned = `${header}.${payload}`;

  const pubKeyBuffer = Buffer.from(vapidKeys.publicKey, "base64url");
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: pubKeyBuffer.subarray(1, 33).toString("base64url"),
    y: pubKeyBuffer.subarray(33, 65).toString("base64url"),
    d: Buffer.from(vapidKeys.privateKey, "base64url").toString("base64url"),
  };

  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const sig = crypto.sign("SHA256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  });

  return `${unsigned}.${sig.toString("base64url")}`;
}

/**
 * Encrypt a push message payload (RFC 8291 / aes128gcm).
 */
function encryptPayload(
  sub: PushSub,
  payload: string,
): { body: Buffer; headers: Record<string, string> } {
  const userPublicKey = Buffer.from(sub.keys.p256dh, "base64url");
  const userAuth = Buffer.from(sub.keys.auth, "base64url");

  const localKey = crypto.createECDH("prime256v1");
  localKey.generateKeys();
  const localPublicKey = localKey.getPublicKey();

  const sharedSecret = localKey.computeSecret(userPublicKey);

  const salt = crypto.randomBytes(16);

  const authInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    userPublicKey,
    localPublicKey,
  ]);

  const prk = crypto
    .createHmac("sha256", userAuth)
    .update(sharedSecret)
    .digest();
  const ikm = hkdfExpand(prk, authInfo, 32);
  const contentPrk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const cek = hkdfExpand(
    contentPrk,
    Buffer.from("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = hkdfExpand(
    contentPrk,
    Buffer.from("Content-Encoding: nonce\0"),
    12,
  );

  // Pad with a delimiter byte (0x02) per RFC 8188
  const padded = Buffer.concat([
    Buffer.from(payload, "utf-8"),
    Buffer.from([2]),
  ]);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(padded),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // aes128gcm header: salt(16) + rs(4 BE) + idlen(1) + keyid(65)
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  const header = Buffer.concat([salt, rs, Buffer.from([65]), localPublicKey]);
  const body = Buffer.concat([header, encrypted]);

  return {
    body,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Content-Length": String(body.length),
      TTL: "86400",
    },
  };
}

/**
 * Send a push notification to a specific user.
 * Exported so other server modules (reminders, alerts) can call it.
 */
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url?: string; tag?: string },
): Promise<number> {
  const subs = subscriptions.get(userId);
  if (!subs || subs.length === 0) return 0;

  const payload = JSON.stringify(notification);
  let sent = 0;

  for (const sub of subs) {
    try {
      const origin = new URL(sub.endpoint).origin;
      const jwt = createVapidJwt(origin);
      const encrypted = encryptPayload(sub, payload);

      const res = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          ...encrypted.headers,
          Authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        },
        body: new Uint8Array(encrypted.body),
      });

      if (res.status === 200 || res.status === 201) {
        sent++;
      } else if (res.status === 404 || res.status === 410) {
        // Subscription expired — remove it
        const idx = subs.indexOf(sub);
        if (idx >= 0) subs.splice(idx, 1);
      } else {
        console.warn(`[Push] Failed to send to ${sub.endpoint}: ${res.status}`);
      }
    } catch (err) {
      console.warn("[Push] Send error:", err);
    }
  }

  if (subs.length === 0) subscriptions.delete(userId);
  return sent;
}

/** Send a push notification to all subscribed users. */
export async function sendPushToAll(notification: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<number> {
  let total = 0;
  for (const userId of subscriptions.keys()) {
    total += await sendPushToUser(userId, notification);
  }
  return total;
}

// ── Routes ──────────────────────────────────────────────────────────────────

export const pushRoutes = new Elysia({ prefix: "/api" })
  // Public: get VAPID public key (needed by the browser to subscribe)
  .get("/push/vapid-key", () => ok({ vapidPublicKey: vapidKeys.publicKey }))

  // Authenticated: save push subscription
  .post("/user/push-subscription", ({ request, body, set }) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const data = body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!data?.endpoint || !data?.keys?.p256dh || !data?.keys?.auth) {
      set.status = 400;
      return fail("Invalid push subscription");
    }

    const sub: PushSub = {
      endpoint: data.endpoint,
      keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
    };

    const userSubs = subscriptions.get(userId) ?? [];
    if (!userSubs.some((s) => s.endpoint === sub.endpoint)) {
      userSubs.push(sub);
      subscriptions.set(userId, userSubs);
    }

    console.log(
      `[Push] Subscription saved for user ${userId} (${userSubs.length} devices)`,
    );
    return ok({ subscribed: true });
  })

  // Authenticated: remove push subscription
  .delete("/user/push-subscription", ({ request, body, set }) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const data = body as { endpoint?: string };
    if (!data?.endpoint) {
      set.status = 400;
      return fail("Endpoint required");
    }

    const userSubs = subscriptions.get(userId);
    if (userSubs) {
      const idx = userSubs.findIndex((s) => s.endpoint === data.endpoint);
      if (idx >= 0) userSubs.splice(idx, 1);
      if (userSubs.length === 0) subscriptions.delete(userId);
    }

    return ok({ subscribed: false });
  })

  // Authenticated: test push (send a test notification to yourself)
  .post("/push/test", async ({ request, set }) => {
    const userId = userIdFromRequest(request);
    if (!userId) {
      set.status = 401;
      return fail("Unauthorized");
    }

    const sent = await sendPushToUser(userId, {
      title: "FinTrack 🔔",
      body: "Push notification berhasil! Kamu akan menerima notifikasi penting di sini.",
      url: "/dashboard",
      tag: "test",
    });

    if (sent === 0) {
      set.status = 404;
      return fail(
        "Tidak ada subscription aktif. Aktifkan push notification di Settings.",
      );
    }

    return ok({ sent });
  });
